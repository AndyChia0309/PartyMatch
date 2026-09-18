import prisma from '../lib/prisma.js'
import { computeSeatCost } from '../utils/pricing.js'
import { notify, notifyBatch, notifyGroupConversation, claimGroupStatus } from '../routes/groups/shared.js'
import { rejectPendingApplications } from './membershipLifecycle.service.js'
import { encryptCredential } from '../lib/credentialEncryption.js'
import { HOST_PUBLIC_SELECT } from '../lib/groupPrivacy.js'

const HOST_GROUP_INCLUDE = {
  host:    HOST_PUBLIC_SELECT,
  service: true,
  _count:  { select: { members: true } },
};

const MAX_BILLING_DATE_ADJUST_DAYS = 7
const DISPUTE_COOLDOWN_MINUTES = 1

function httpError(statusCode, message, extra) {
  const err = new Error(message)
  err.statusCode = statusCode
  if (extra) Object.assign(err, extra)
  return err
}

function groupLabelOf(group) {
  return group.planName ?? group.service?.name ?? ''
}

function addHours(hours) {
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d
}

function formatDateSlash(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '/');
}

export function allMembersSettled(members, now = new Date()) {
  return members.length > 0 && members.every(m =>
    m.confirmedAt != null || (m.confirmDeadline && new Date(m.confirmDeadline) <= now)
  )
}

export async function activateGroup({ groupId, hostId, nextBillingDate: requestedRaw }) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true, service: true },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.hostId !== hostId) throw httpError(403, '僅團主可操作')
  if (group.status !== 'pending_activation') throw httpError(400, `群組狀態為 ${group.status}，無法啟用（需為 pending_activation）`)
  if (group.members.some(m => m.serviceInfoIssueNote)) throw httpError(400, '有成員的帳號資訊尚待處理，請先協助修正後再啟用服務')

  const confirmDeadline = addHours(48)

  const isFirstActivation = !group.hasActivatedOnce;

  const baseline = new Date(isFirstActivation ? Date.now() : group.nextBillingDate)
  baseline.setUTCHours(0, 0, 0, 0)
  const minAllowed = new Date(baseline)
  if (group.billingCycle === 'yearly') minAllowed.setFullYear(minAllowed.getFullYear() + 1)
  else minAllowed.setMonth(minAllowed.getMonth() + 1)
  const maxAllowed = new Date(minAllowed)
  maxAllowed.setDate(maxAllowed.getDate() + 30)

  let nextBillingDate
  if (requestedRaw) {
    const requested = new Date(requestedRaw)
    if (Number.isNaN(requested.getTime())) throw httpError(400, '日期格式不正確')
    if (requested < minAllowed) throw httpError(400, `扣款日期最早不能早於 ${formatDateSlash(minAllowed)}`)
    if (requested > maxAllowed) throw httpError(400, `扣款日期最晚不能超過 ${formatDateSlash(maxAllowed)}`)
    nextBillingDate = requested
  } else if (isFirstActivation) {
    throw httpError(400, '請填寫扣款日期')
  } else {
    nextBillingDate = minAllowed
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedGroup = await tx.group.update({
      where: { id: groupId },
      data: {
        status: 'confirming',
        hasActivatedOnce: true,
        activateDeadline: null,
        nextBillingDate,
      },
      include: HOST_GROUP_INCLUDE,
    })
    await tx.member.updateMany({
      where: { groupId },
      data:  { confirmDeadline },
    })
    await tx.subscription.updateMany({
      where: { groupId },
      data:  { nextBillingDate },
    })
    return updatedGroup
  });

  const groupLabel = groupLabelOf(group)
  const groupLabelForActivation = groupLabelOf(group)
  await notify({
    userId:  group.hostId,
    type:    'group_activated',
    title:   '服務已啟用，確認期開始',
    message: `「${groupLabelForActivation}」群組服務已啟用，成員有 48 小時確認期。`,
    meta:    { groupId },
  })
  await notifyBatch(group.members.map(m => ({
    userId:  m.userId,
    type:    'group_activated',
    title:   `${groupLabelForActivation}服務已啟用，確認期開始`,
    message: `「${groupLabelForActivation}」服務已啟用，請在 48 小時內確認服務是否正常運作。`,
    meta:    { groupId },
  })))

  const finalDateText = formatDateSlash(nextBillingDate)
  await notifyBatch([group.hostId, ...group.members.map(m => m.userId)].map(userId => ({
    userId,
    type:    'billing_date_confirmed',
    title:   '扣款日期已確定',
    message: `「${groupLabel}」服務已啟用，扣款日期確定為 ${finalDateText}。`,
    meta:    { groupId, nextBillingDate: nextBillingDate.toISOString(), estimated: false },
  })))

  prisma.credentialComment.create({
    data: {
      groupId,
      authorId: group.hostId,
      content:  `${groupLabelForActivation} 服務已啟用！請在 48 小時內確認服務是否正常運作。`,
    },
  }).catch(console.error)

  return updated
}

async function applyBillingDateAdjustment(group, requested, note) {
  const current = new Date(group.nextBillingDate)
  const resetConfirmations = group.status === 'confirming'
  const newConfirmDeadline = addHours(48)

  const ops = [
    prisma.group.update({
      where: { id: group.id },
      data: {
        nextBillingDate:           requested,
        billingDateAdjustedAt:     new Date(),
        billingDateAdjustmentNote: note,
      },
      include: HOST_GROUP_INCLUDE,
    }),
    prisma.subscription.updateMany({
      where: { groupId: group.id },
      data:  { nextBillingDate: requested },
    }),
  ]
  // 確認期內日期異動屬於重大條件變更，已確認過的成員要重新確認才能繼續，避免他們的舊確認被套用在新日期上
  if (resetConfirmations) {
    ops.push(prisma.member.updateMany({
      where: { groupId: group.id, confirmedAt: { not: null } },
      data:  { confirmedAt: null, confirmDeadline: newConfirmDeadline },
    }))
  }

  const [updated] = await prisma.$transaction(ops)

  const groupLabel = groupLabelOf(group);
  const oldDateText = formatDateSlash(current)
  const newDateText = formatDateSlash(requested)
  notifyBatch(group.members.map(m => ({
    userId:  m.userId,
    type:    'billing_date_adjusted',
    title:   `${groupLabel} 扣款日期已調整`,
    message: `「${groupLabel}」的扣款日期由 ${oldDateText} 調整為 ${newDateText}，原因：${note}。${resetConfirmations ? '如果你已經確認過服務，請針對新日期重新確認一次。' : ''}`,
    meta:    { groupId: group.id, oldDate: current.toISOString(), nextBillingDate: requested.toISOString(), note },
  })))

  return updated
}

export async function adjustBillingDate({ groupId, hostId, nextBillingDate: requestedRaw, note: noteRaw }) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true, service: true },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.hostId !== hostId) throw httpError(403, '僅團主可操作')
  if (group.status !== 'confirming') throw httpError(400, `群組狀態為 ${group.status}，只能在確認期調整扣款日`)
  if (group.billingDateAdjustedAt) throw httpError(400, '本期已經調整過扣款日，每期僅能調整一次')
  if (!group.nextBillingDate) throw httpError(400, '這個群組目前沒有扣款日可以調整')

  const requested = new Date(requestedRaw)
  if (Number.isNaN(requested.getTime())) throw httpError(400, '日期格式不正確')

  const current = new Date(group.nextBillingDate);
  const maxAllowed = new Date(current)
  maxAllowed.setDate(maxAllowed.getDate() + MAX_BILLING_DATE_ADJUST_DAYS)
  if (requested <= current) throw httpError(400, '新的扣款日只能比原本的日期晚')
  if (requested > maxAllowed) throw httpError(400, `最多只能延後 ${MAX_BILLING_DATE_ADJUST_DAYS} 天`)

  return applyBillingDateAdjustment(group, requested, noteRaw.trim())
}

// 管理員透過「聯繫客服」工單裁定的例外調整：不限狀態一定要 confirming（active 期間也能用）、
// 不受一般調整的 7 天上限與每期一次限制，因為是仲裁例外而非常規操作
export async function adminAdjustBillingDate({ groupId, nextBillingDate: requestedRaw, note: noteRaw }) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true, service: true },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (!['confirming', 'active'].includes(group.status)) throw httpError(400, `群組狀態為 ${group.status}，無法調整扣款日`)
  if (!group.nextBillingDate) throw httpError(400, '這個群組目前沒有扣款日可以調整')
  if (!noteRaw?.trim()) throw httpError(400, '請填寫調整原因')

  const requested = new Date(requestedRaw)
  if (Number.isNaN(requested.getTime())) throw httpError(400, '日期格式不正確')

  const current = new Date(group.nextBillingDate)
  if (requested <= current) throw httpError(400, '新的扣款日只能比原本的日期晚')

  return applyBillingDateAdjustment(group, requested, noteRaw.trim())
}

async function tryReleaseEscrow(tx, groupId, hostId) {
  const [group, members] = await Promise.all([
    tx.group.findUnique({ where: { id: groupId } }),
    tx.member.findMany({ where: { groupId } }),
  ])
  if (!group || group.status !== 'confirming') return null
  if (!allMembersSettled(members)) return null

  const claimed = await tx.group.updateMany({
    where: { id: groupId, status: 'confirming' },
    data:  { status: 'active', escrowTokens: 0 },
  })
  if (claimed.count === 0) return null

  await tx.user.update({
    where: { id: hostId },
    data:  { tokenBalance: { increment: group.escrowTokens } },
  });
  await tx.tokenTransaction.create({
    data: {
      userId:        hostId,
      type:          'release',
      amount:        group.escrowTokens,
      relatedGroupId: groupId,
      cycle:         group.currentCycle,
      note:          '確認期結束，代管款項撥付',
    },
  })
  await tx.subscription.updateMany({
    where: { groupId },
    data:  { status: 'active' },
  })

  return group.escrowTokens
}

async function tryAdvanceToActivation(tx, groupId) {
  const members = await tx.member.findMany({ where: { groupId } })
  const allClear = members.length > 0 && members.every(m => m.serviceInfo != null && !m.serviceInfoIssueNote)
  if (!allClear) return false

  const claimed = await tx.group.updateMany({
    where: { id: groupId, status: 'pending_confirmation' },
    data:  { status: 'pending_activation', activateDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  })
  return claimed.count > 0
}

function notifyEscrowReleased(group, hostId) {
  const groupLabel = groupLabelOf(group)
  notify({
    userId:  hostId,
    type:    'escrow_released',
    title:   `${groupLabel} 已確認，代管金額將存入您的PM幣帳戶，請前往查收`,
    message: `「${groupLabel}」群組確認期結束，代管款項已撥入你的PM幣餘額。`,
    meta:    { groupId: group.id },
  })
  const memberUserIds = (group.members ?? []).map(m => m.userId)
  if (memberUserIds.length > 0) {
    notifyBatch(memberUserIds.map(userId => ({
      userId,
      type:    'escrow_released_member',
      title:   `${groupLabel} 確認期結束，服務正式啟用`,
      message: `「${groupLabel}」確認期已結束，服務已正式啟用。`,
      meta:    { groupId: group.id },
    })))
  }

  notifyBatch([hostId, ...memberUserIds].map(userId => ({
    userId,
    type:    'service_review_reminder',
    title:   `${groupLabel} 服務已正式啟用，快給彼此一個評價吧`,
    message: `「${groupLabel}」確認期已結束，歡迎為這次的合購夥伴留下評價。`,
    meta:    { groupId: group.id },
  })))
}

export async function confirmService({ groupId, userId }) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      host:    { select: { id: true } },
      service: { select: { name: true } },
    },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.status !== 'confirming' && group.status !== 'disputed') throw httpError(400, `群組狀態為 ${group.status}，不在確認期`)

  const member = group.members.find(m => m.userId === userId)
  if (!member)
    throw httpError(403, '你不是此群組成員');

  if (group.status === 'disputed' && member.serviceInfoIssueNote) {
    throw httpError(400, '你回報的問題尚在處理中，請等待團主或平台裁定後再確認')
  }

  const now = new Date()
  const groupLabel = groupLabelOf(group)

  await prisma.member.update({ where: { id: member.id }, data: { confirmedAt: now } })

  prisma.credentialComment.create({
    data: { groupId, authorId: userId, content: '已確認服務' },
  }).catch(console.error)

  notify({
    userId:  group.hostId,
    type:    'member_confirmed_service',
    title:   `${groupLabel} 成員已確認服務正常`,
    message: `${member.user.name} 已確認「${groupLabel}」服務正常。`,
    meta:    { groupId },
  });

  if (group.status === 'disputed')
    return { group: null, released: false }

  const releasedAmount = await prisma.$transaction(tx => tryReleaseEscrow(tx, groupId, group.host.id))
  if (releasedAmount == null) {
    const currentGroup = await prisma.group.findUnique({ where: { id: groupId } });
    if (currentGroup?.status === 'active') return { group: { ...currentGroup, escrowTokens: 0 }, released: true }
    return { group: null, released: false }
  }

  notifyEscrowReleased(group, group.host.id)
  notifyGroupConversation(groupId, member.userId, `確認期結束，代管款項已撥款給團主。`).catch(console.error)

  const finalGroup = await prisma.group.findUnique({ where: { id: groupId }, include: HOST_GROUP_INCLUDE });
  return { group: { ...finalGroup, escrowTokens: 0 }, released: true }
}

export async function raiseDispute({ groupId, userId, reason, evidenceUrl }) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      service: { select: { name: true } },
    },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.status !== 'confirming' && group.status !== 'disputed') throw httpError(400, `群組狀態為 ${group.status}，不在確認期`)

  const member = group.members.find(m => m.userId === userId)
  if (!member)
    throw httpError(403, '你不是此群組成員');
  if (member.serviceInfoIssueNote)
    throw httpError(400, '你已經回報過問題，正在等待處理');
  if (member.lastDisputeActionAt) {
    const cooldownEndsAt = new Date(member.lastDisputeActionAt.getTime() + DISPUTE_COOLDOWN_MINUTES * 60 * 1000)
    if (cooldownEndsAt > new Date()) {
      throw httpError(400, '回報過於頻繁，請稍後再試', { code: 'DISPUTE_COOLDOWN', cooldownEndsAt: cooldownEndsAt.toISOString() })
    }
  }

  const disputeDeadline = addHours(48);
  const groupLabel = groupLabelOf(group)
  const trimmedReason = reason.trim()

  const updated = await prisma.$transaction(async (tx) => {
    if (group.status === 'confirming') {
      await claimGroupStatus(tx, groupId, {
        fromStatus: 'confirming',
        data:       { status: 'disputed' },
      });
    }

    await tx.member.update({
      where: { id: member.id },
      data:  {
        serviceInfoIssueNote: trimmedReason,
        disputeDeadline:      disputeDeadline,
        lastDisputeActionAt:  new Date(),
        ...(evidenceUrl ? { disputeEvidenceUrl: evidenceUrl } : {}),
      },
    })

    await tx.dispute.create({
      data: {
        groupId,
        memberId:             member.id,
        raisedByUserId:       userId,
        hostId:               group.hostId,
        planNameSnapshot:     groupLabel,
        reason:               trimmedReason,
        evidenceUrl:          evidenceUrl ?? null,
        seatCostSnapshot:     computeSeatCost(group),
        escrowTokensSnapshot: group.escrowTokens,
        deadline:             disputeDeadline,
      },
    })

    return tx.group.findUnique({ where: { id: groupId }, include: HOST_GROUP_INCLUDE })
  })

  notify({
    userId:  group.hostId,
    type:    'dispute_raised',
    title:   `${groupLabel} ${member.user.name}回報問題`,
    message: `${member.user.name} 針對「${groupLabel}」服務回報問題，請於 48 小時內處理完成。`,
    meta:    { groupId, memberId: member.id },
  })
  prisma.credentialComment.create({
    data: {
      groupId,
      authorId: member.userId,
      content:  `已提出問題回報：${reason.trim()}`.slice(0, 500),
    },
  }).catch(console.error);

  return updated
}

export async function reportServiceInfoIssue({ groupId, hostId, memberId, note, evidenceUrl }) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      service: { select: { name: true } },
    },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.hostId !== hostId) throw httpError(403, '僅團主可操作')
  if (group.status !== 'pending_confirmation' && group.status !== 'pending_activation')
    throw httpError(400, `群組狀態為 ${group.status}，無法提出問題回報`)

  const member = group.members.find(m => m.id === memberId)
  if (!member) throw httpError(404, '找不到成員')
  if (member.serviceInfoIssueNote) throw httpError(400, '這位成員已經有待處理的問題回報')

  const trimmedNote = note.trim()
  const groupLabel = groupLabelOf(group)
  const deadline = addHours(48)
  const serviceInfoIssueDeadline = addHours(24)

  const updated = await prisma.$transaction(async (tx) => {
    if (group.status === 'pending_activation') {
      await claimGroupStatus(tx, groupId, {
        fromStatus: 'pending_activation',
        data:       { status: 'pending_confirmation', activateDeadline: null },
      })
    }

    await tx.member.update({
      where: { id: member.id },
      data:  {
        serviceInfoIssueNote: trimmedNote,
        serviceInfoIssueDeadline,
        ...(evidenceUrl ? { serviceInfoIssueEvidenceUrl: evidenceUrl } : {}),
      },
    })

    await tx.dispute.create({
      data: {
        groupId,
        memberId:             member.id,
        raisedByUserId:       hostId,
        hostId:               group.hostId,
        planNameSnapshot:     groupLabel,
        reason:               trimmedNote,
        evidenceUrl:          evidenceUrl ?? null,
        seatCostSnapshot:     computeSeatCost(group),
        escrowTokensSnapshot: group.escrowTokens,
        deadline,
      },
    })

    return tx.group.findUnique({ where: { id: groupId }, include: HOST_GROUP_INCLUDE })
  })

  notify({
    userId:  member.userId,
    type:    'service_info_issue',
    title:   `${groupLabel} 帳號資訊需要修正`,
    message: `團主在「${groupLabel}」發現帳號資訊問題，請前往修正。`,
    meta:    { groupId },
  })

  prisma.credentialComment.create({
    data: { groupId, authorId: hostId, content: `已對 ${member.user.name} 提出問題回報，請協助處理！` },
  }).catch(console.error)

  return updated
}

export async function withdrawServiceInfoIssue({ groupId, hostId, memberId }) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      service: { select: { name: true } },
    },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.hostId !== hostId) throw httpError(403, '僅團主可操作')

  const member = group.members.find(m => m.id === memberId && m.serviceInfoIssueNote)
  if (!member) throw httpError(400, '找不到待處理的問題回報')

  const dispute = await prisma.dispute.findFirst({ where: { groupId, memberId, status: 'pending' } })
  if (!dispute) throw httpError(400, '找不到進行中的問題回報')

  const groupLabel = groupLabelOf(group)

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: dispute.id, status: 'pending' },
      data:  { status: 'withdrawn_by_host', resolvedAt: new Date() },
    })
    if (claimed.count === 0) throw httpError(409, '這筆問題回報已經被處理過了，請重新整理頁面', { responsePayload: { code: 'DISPUTE_ALREADY_CLAIMED' } })

    await tx.member.update({
      where: { id: member.id },
      data:  { serviceInfoIssueNote: null, serviceInfoIssueEvidenceUrl: null, serviceInfoIssueDeadline: null },
    })

    // 撤銷回報時若全員已填完，代表「全部完成」這個狀態本來就已經達成過，
    // 只是被這筆問題回報打斷，不算新事件，不重複發送「全部完成」通知
    await tryAdvanceToActivation(tx, groupId)
  })

  notify({
    userId:  member.userId,
    type:    'service_info_issue_resolved',
    title:   `${groupLabel} 問題回報已撤銷`,
    message: `團主已撤銷針對「${groupLabel}」你帳號資訊的問題回報。`,
    meta:    { groupId },
  })

  prisma.credentialComment.create({
    data: { groupId, authorId: hostId, content: `已撤銷對 ${member.user.name} 的問題回報` },
  }).catch(console.error)

  return prisma.group.findUnique({ where: { id: groupId }, include: HOST_GROUP_INCLUDE })
}

async function applyDisputeWithdrawal({ group, member, dispute }) {
  const groupLabel = groupLabelOf(group)

  const { updated, releasedAmount } = await prisma.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: dispute.id, status: 'pending' },
      data:  { status: 'withdrawn_by_member', resolvedAt: new Date() },
    })
    if (claimed.count === 0) throw httpError(409, '這筆申訴已經被處理過了，請重新整理頁面', { responsePayload: { code: 'DISPUTE_ALREADY_CLAIMED' } })

    await tx.member.update({
      where: { id: member.id },
      data:  { serviceInfoIssueNote: null, disputeEvidenceUrl: null, disputeDeadline: null, disputeEscalatedAt: null, lastDisputeActionAt: new Date() },
    })

    const remainingPending = await tx.dispute.count({ where: { groupId: group.id, status: 'pending' } });
    let releasedAmount = null
    if (remainingPending === 0) {
      await claimGroupStatus(tx, group.id, {
        fromStatus: 'disputed',
        data:       { status: 'confirming' },
        message:    '這個群組的申訴狀態剛好被更新了，請重新整理頁面',
      });
      releasedAmount = await tryReleaseEscrow(tx, group.id, group.hostId)
    }

    return { updated: await tx.group.findUnique({ where: { id: group.id }, include: HOST_GROUP_INCLUDE }), releasedAmount }
  })

  notify({
    userId:  group.hostId,
    type:    'dispute_withdrawn',
    title:   `${groupLabel} ${member.user.name}已撤銷問題回報`,
    message: `${member.user.name} 已撤銷針對「${groupLabel}」的問題回報。`,
    meta:    { groupId: group.id },
  });

  if (releasedAmount != null) notifyEscrowReleased(group, group.hostId)

  prisma.credentialComment.create({
    data: {
      groupId:  group.id,
      authorId: member.userId,
      content:  `${member.user.name} 已撤銷問題回報`,
    },
  }).catch(console.error)

  return updated
}

export async function withdrawDispute({ groupId, userId }) {
  const group = await prisma.group.findUnique({
    where:   { id: groupId },
    include: { members: { include: { user: { select: { id: true, name: true } } } }, service: { select: { name: true } } },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.status !== 'disputed') throw httpError(409, '這筆申訴已經被處理過了，請重新整理頁面', { responsePayload: { code: 'DISPUTE_ALREADY_CLAIMED' } })

  const member = group.members.find(m => m.userId === userId)
  if (!member) throw httpError(403, '你不是此群組成員');
  if (!member.serviceInfoIssueNote) throw httpError(400, '你目前沒有進行中的問題回報')

  const dispute = await prisma.dispute.findFirst({ where: { groupId, memberId: member.id, status: 'pending' } })
  if (!dispute) throw httpError(400, '找不到進行中的申訴')

  return applyDisputeWithdrawal({ group, member, dispute })
}

export async function resolveDisputeByHost({ groupId, hostId, memberId, note }) {
  const group = await prisma.group.findUnique({
    where:   { id: groupId },
    include: { members: { include: { user: { select: { id: true, name: true } } } }, service: { select: { name: true } } },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.hostId !== hostId) throw httpError(403, '僅團主可操作')
  if (group.status !== 'disputed') throw httpError(409, '這筆申訴已經被處理過了，請重新整理頁面', { responsePayload: { code: 'DISPUTE_ALREADY_CLAIMED' } })

  const disputeMember = group.members.find(m => m.id === memberId && m.serviceInfoIssueNote)
  if (!disputeMember) throw httpError(400, '找不到申訴成員')

  const dispute = await prisma.dispute.findFirst({ where: { groupId, memberId, status: 'pending' } })
  if (!dispute) throw httpError(400, '找不到進行中的申訴')

  const confirmDeadline = addHours(48);
  const groupLabel = groupLabelOf(group)

  const { updated, releasedAmount } = await prisma.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: dispute.id, status: 'pending' },
      data:  {
        status:           'resolved_by_host',
        resolutionType:   'host_private_resolved',
        resolvedByHostAt: new Date(),
        resolutionNote:   note ?? null,
        resolvedAt:       new Date(),
      },
    })
    if (claimed.count === 0) throw httpError(409, '這筆申訴已經被處理過了，請重新整理頁面', { responsePayload: { code: 'DISPUTE_ALREADY_CLAIMED' } })

    await tx.member.update({
      where: { id: disputeMember.id },
      data:  { serviceInfoIssueNote: null, disputeEvidenceUrl: null, confirmedAt: null, disputeDeadline: null, disputeEscalatedAt: null, confirmDeadline },
    })

    const remainingPending = await tx.dispute.count({ where: { groupId, status: 'pending' } });
    let releasedAmount = null
    if (remainingPending === 0) {
      await claimGroupStatus(tx, groupId, {
        fromStatus: 'disputed',
        data:       { status: 'confirming' },
        message:    '這筆申訴剛好已經被處理過了，請重新整理頁面',
      });
      releasedAmount = await tryReleaseEscrow(tx, groupId, group.hostId)
    }

    return { updated: await tx.group.findUnique({ where: { id: groupId }, include: HOST_GROUP_INCLUDE }), releasedAmount }
  })

  notify({
    userId:  disputeMember.userId,
    type:    'dispute_resolved_by_host',
    title:   `${groupLabel} 問題已處理完成`,
    message: `團主已回覆「${groupLabel}」你回報的問題並處理完成，請重新確認服務是否正常。`,
    meta:    { groupId },
  });

  if (releasedAmount != null) notifyEscrowReleased(group, group.hostId)

  prisma.credentialComment.create({
    data: {
      groupId,
      authorId: hostId,
      content:  (note ? `${disputeMember.user.name}的問題已處理完成：${note}` : `${disputeMember.user.name}的問題已處理完成`).slice(0, 500),
    },
  }).catch(console.error)

  return updated
}

export async function escalateDisputeToAdmin({ groupId, hostId, memberId, note }) {
  const group = await prisma.group.findUnique({
    where:   { id: groupId },
    include: { members: { include: { user: { select: { id: true, name: true } } } }, service: { select: { name: true } } },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.hostId !== hostId) throw httpError(403, '僅團主可操作')
  if (group.status !== 'disputed') throw httpError(409, '這筆申訴已經被處理過了，請重新整理頁面', { responsePayload: { code: 'DISPUTE_ALREADY_CLAIMED' } })

  const disputeMember = group.members.find(m => m.id === memberId && m.serviceInfoIssueNote)
  if (!disputeMember) throw httpError(400, '找不到申訴成員')

  const dispute = await prisma.dispute.findFirst({ where: { groupId, memberId, status: 'pending' } })
  if (!dispute) throw httpError(400, '找不到進行中的申訴')

  const trimmedNote = note?.trim()
  if (!trimmedNote) throw httpError(400, '請說明你認為此回報不實的理由')

  const disputeEscalatedAt = new Date()
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: dispute.id, status: 'pending' },
      data:  { hostDisputed: true, hostResponseNote: trimmedNote, hostRespondedAt: disputeEscalatedAt },
    })
    if (claimed.count === 0) throw httpError(409, '這筆申訴已經被處理過了，請重新整理頁面', { responsePayload: { code: 'DISPUTE_ALREADY_CLAIMED' } })

    await tx.member.update({
      where: { id: disputeMember.id },
      data:  { disputeEscalatedAt },
    })
  })

  const groupLabel = groupLabelOf(group)

  notifyBatch([group.hostId, disputeMember.userId].map(userId => ({
    userId,
    type:    'dispute_escalated',
    title:   `${groupLabel} 問題回報已由平台接管`,
    message: `「${groupLabel}」的問題回報已由平台客服接管處理，請耐心等候。`,
    meta:    { groupId },
  })))

  prisma.credentialComment.create({
    data: {
      groupId,
      authorId: hostId,
      content:  `${disputeMember.user.name}的問題回報將由平台介入處理，理由：${trimmedNote}`.slice(0, 500),
    },
  }).catch(console.error)

  return prisma.group.findUnique({ where: { id: groupId }, include: HOST_GROUP_INCLUDE })
}

export async function cancelGroup({ groupId, hostId }) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: { service: { select: { name: true } } } })
  if (!group) throw httpError(404, '群組不存在')
  if (group.hostId !== hostId) throw httpError(403, '僅團主可解散群組')

  const cancellable = ['recruiting', 'full']
  if (!cancellable.includes(group.status)) throw httpError(400, `群組已鎖定（狀態為 ${group.status}），無法解散`)

  const seatCost = computeSeatCost(group)
  const groupLabelForCancel = groupLabelOf(group)

  const currentMembers = await prisma.$transaction(async (tx) => {
    const updated = await tx.group.updateMany({
      where: { id: groupId, status: { in: cancellable } },
      data:  { status: 'cancelled' },
    });
    if (updated.count === 0) throw httpError(409, '群組狀態已變動，請重新整理頁面')

    const currentMembers = await tx.member.findMany({ where: { groupId } });
    if (currentMembers.length > 0) {
      await tx.user.updateMany({
        where: { id: { in: currentMembers.map(m => m.userId) } },
        data:  { tokenBalance: { increment: seatCost } },
      });
      await tx.tokenTransaction.createMany({
        data: currentMembers.map(m => ({
          userId:        m.userId,
          type:          'refund',
          amount:        seatCost,
          relatedGroupId: groupId,
          cycle:         group.currentCycle,
          note:          '群組解散，代管退款',
        })),
      })
    }

    await rejectPendingApplications(tx, groupId, {
      refundNote:   '群組已解散，代管退款',
      buildMessage: groupLabel => `很遺憾，「${groupLabel}」群組已被團主解散，你的申請未通過，代管費用已退還至你的PM幣餘額。`,
    });

    await tx.group.update({ where: { id: groupId }, data: { escrowTokens: 0 } })

    return currentMembers
  })

  notifyBatch(currentMembers.map(m => ({
    userId:  m.userId,
    type:    'group_cancelled',
    title:   `${groupLabelForCancel} 群組已解散`,
    message: `「${groupLabelForCancel}」群組已被團主解散，代管費用已退還至你的PM幣餘額。`,
    meta:    { groupId },
  })))

  return { status: 'cancelled' }
}

export async function lockGroup({ groupId, hostId, sharedCredentials: sharedCredentialsRaw }) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true, service: true },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.hostId !== hostId) throw httpError(403, '僅團主可操作')
  if (group.status !== 'full')
    throw httpError(400, `群組狀態為 ${group.status}，無法鎖定（需為 full）`);

  const serviceInfoDeadline = new Date();
  serviceInfoDeadline.setHours(serviceInfoDeadline.getHours() + 24)

  const sharedCredentials = typeof sharedCredentialsRaw === 'string' && sharedCredentialsRaw.trim()
    ? encryptCredential(sharedCredentialsRaw.trim())
    : undefined;

  const [updated] = await prisma.$transaction([
    prisma.group.update({
      where: { id: groupId },
      data: {
        status: 'pending_confirmation',
        serviceInfoDeadline,
        billingDateAdjustedAt:     null,
        billingDateAdjustmentNote: null,
        ...(sharedCredentials !== undefined && { sharedCredentials }),
      },
      include: HOST_GROUP_INCLUDE,
    }),
  ])

  const groupLabel = groupLabelOf(group);
  const existingConversation = await prisma.conversation.findFirst({ where: { type: 'group', groupId } })
  if (!existingConversation) {
    await prisma.conversation.create({
      data: { type: 'group', groupId, participants: [group.hostId, ...group.members.map(m => m.userId)] },
    })
  }
  notifyGroupConversation(groupId, group.hostId, `「${groupLabel}」聊天室已啟用。`).catch(console.error)

  const isSharedCredentials = sharedCredentials !== undefined;
  notify({
    userId:  group.hostId,
    type:    'group_chat_opened',
    title:   `${groupLabel}服務已鎖定`,
    message: `「${groupLabel}」群組已鎖定，聊天室已建立。`,
    meta:    { groupId },
  })
  notifyBatch(group.members.flatMap(m => [
    {
      userId:  m.userId,
      type:    'group_chat_opened',
      title:   `${groupLabel}服務已鎖定`,
      message: `「${groupLabel}」群組已鎖定，聊天室已建立。`,
      meta:    { groupId },
    },
    {
      userId:  m.userId,
      type:    'fill_service_info',
      title:   isSharedCredentials ? `請提取${groupLabel}帳號資訊` : '請填寫帳號資訊',
      message: isSharedCredentials
        ? `「${groupLabel}」群組已鎖定，請進入提取帳號資訊。`
        : `「${groupLabel}」群組已鎖定，請進入填寫帳號資訊。`,
      meta:    { groupId },
    },
  ]))

  return updated
}

export async function adjudicateDispute({ groupId, adminId, memberId, winner, reason }) {
  if (!['member', 'host'].includes(winner)) throw httpError(400, 'winner 必須為 member 或 host')
  if (!reason?.trim()) throw httpError(400, '請填寫裁定說明')

  const group = await prisma.group.findUnique({
    where:   { id: groupId },
    include: { members: { include: { user: { select: { id: true } } } }, service: { select: { name: true } } },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.status !== 'disputed') throw httpError(409, '這筆申訴已經被處理過了，請重新整理頁面', { responsePayload: { code: 'DISPUTE_ALREADY_CLAIMED' } })

  const disputeMember = group.members.find(m => m.id === memberId && m.serviceInfoIssueNote);
  if (!disputeMember) throw httpError(400, '找不到申訴成員')

  const dispute = await prisma.dispute.findFirst({ where: { groupId, memberId, status: 'pending' } })
  if (!dispute)
    throw httpError(400, '找不到進行中的申訴');

  const groupLabel = groupLabelOf(group)
  const trimmedReason = reason.trim()
  const resolutionType = winner === 'member' ? 'member_wins' : 'host_wins'

  const seatCost = computeSeatCost(group);
  const memberRefundAmount = winner === 'member' ? seatCost : 0
  const confirmDeadline = addHours(48);

  const releasedAmount = await prisma.$transaction(async (tx) => {
    const claimed = await tx.dispute.updateMany({
      where: { id: dispute.id, status: 'pending' },
      data:  {
        status:             'adjudicated',
        resolutionType,
        resolvedByAdminId:  adminId,
        memberRefundAmount,
        hostReleaseAmount:  0,
        resolutionNote:     trimmedReason,
        resolvedAt:         new Date(),
      },
    })
    if (claimed.count === 0) throw httpError(409, '這筆申訴已經被裁定過了，請重新整理頁面')

    if (memberRefundAmount > 0) {
      await tx.user.update({
        where: { id: disputeMember.userId },
        data:  { tokenBalance: { increment: memberRefundAmount } },
      })
      await tx.tokenTransaction.create({
        data: { userId: disputeMember.userId, type: 'refund', amount: memberRefundAmount, relatedGroupId: group.id, cycle: group.currentCycle, note: `裁定結果：${trimmedReason}（申訴 #${dispute.id}）` },
      })
      await tx.group.update({
        where: { id: groupId },
        data:  { escrowTokens: { decrement: memberRefundAmount } },
      })
    }

    await tx.member.update({
      where: { id: disputeMember.id },
      data:  {
        serviceInfoIssueNote: null,
        disputeEvidenceUrl:   null,
        disputeDeadline:      null,
        disputeEscalatedAt:   null,
        confirmedAt:          winner === 'member' ? new Date() : null,
        confirmDeadline:      winner === 'host' ? confirmDeadline : null,
      },
    });

    const remainingPending = await tx.dispute.count({ where: { groupId, status: 'pending' } });
    if (remainingPending > 0) return null

    await claimGroupStatus(tx, groupId, {
      fromStatus: 'disputed',
      data:       { status: 'confirming' },
      message:    '這筆申訴剛好已經被處理過了，請重新整理頁面',
    });
    return tryReleaseEscrow(tx, groupId, group.hostId)
  });

  if (releasedAmount != null) notifyEscrowReleased(group, group.hostId)

  const memberMessage = winner === 'member'
    ? `你對「${groupLabel}」回報的問題已確認，本期費用已退還至你的PM幣餘額。`
    : `你對「${groupLabel}」回報的問題經確認後不成立，你仍可留在群組內，請記得確認服務正常，確認後費用才會撥款給團主。`
  const hostMessage = winner === 'member'
    ? `「${groupLabel}」的問題處理結果為成員獲勝，該成員本期費用已退還。`
    : `問題處理結果：「${groupLabel}」該名成員的申訴不成立，費用仍在代管中，待該成員完成確認服務後才會撥款給你。`

  notify({
    userId:  disputeMember.userId,
    type:    'dispute_resolved',
    title:   `${groupLabel} 問題處理結果`,
    message: memberMessage,
    meta:    { groupId: group.id },
  })
  notify({
    userId:  group.hostId,
    type:    'dispute_resolved',
    title:   `${groupLabel} 問題處理結果`,
    message: hostMessage,
    meta:    { groupId: group.id },
  });

  return { disputeId: dispute.id, resolutionType, memberRefundAmount, hostReleaseAmount: 0 };
}

export async function renewGroup({ groupId, hostId, renewingUserIds }) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: { select: { id: true, tokenBalance: true, name: true } } } } },
  })
  if (!group) throw httpError(404, '群組不存在')
  if (group.hostId !== hostId) throw httpError(403, '僅團主可操作')
  if (group.status !== 'active') throw httpError(400, `群組狀態為 ${group.status}，無法開始新一期（需為 active）`)

  const currentMemberIds = group.members.map(m => m.userId)
  const renewSet = Array.isArray(renewingUserIds) && renewingUserIds.length > 0
    ? [...new Set(renewingUserIds)]
    : currentMemberIds
  if (renewSet.some(id => !currentMemberIds.includes(id))) {
    throw httpError(400, '續訂名單包含不在群組內的成員')
  }
  if (renewSet.length === 0) {
    throw httpError(400, '至少需保留一位成員續訂，若要結束服務請使用「結束服務」')
  }

  const renewingMembers = group.members.filter(m => renewSet.includes(m.userId))
  const leavingMembers  = group.members.filter(m => !renewSet.includes(m.userId))
  const hasDropouts = leavingMembers.length > 0

  const seatCost = computeSeatCost(group)

  const insufficient = renewingMembers.filter(m => m.user.tokenBalance < seatCost)
  if (insufficient.length > 0) {
    throw httpError(400, `${insufficient.length} 位成員PM幣餘額不足，無法開始新一期收款`, {
      code:      'INSUFFICIENT_BALANCE',
      memberIds: insufficient.map(m => m.userId),
    })
  }

  let serviceInfoDeadline = null
  if (!hasDropouts) {
    serviceInfoDeadline = new Date();
    serviceInfoDeadline.setHours(serviceInfoDeadline.getHours() + 24)
  }

  const nextStatus = hasDropouts ? 'recruiting' : 'pending_confirmation'

  const updated = await prisma.$transaction(async (tx) => {
    await claimGroupStatus(tx, groupId, {
      fromStatus: 'active',
      data:       { status: nextStatus },
    });

    const charged = await tx.user.updateMany({
      where: { id: { in: renewSet }, tokenBalance: { gte: seatCost } },
      data:  { tokenBalance: { decrement: seatCost } },
    });
    if (charged.count !== renewSet.length) throw httpError(409, '部分成員PM幣餘額於扣款當下不足，請稍後重試')

    const newCycle = group.currentCycle + 1
    await tx.tokenTransaction.createMany({
      data: renewSet.map(userId => ({
        userId,
        type:           'escrow',
        amount:         -seatCost,
        relatedGroupId: groupId,
        cycle:          newCycle,
        note:           `新一期代管 ${seatCost} PM`,
      })),
    })

    await tx.member.updateMany({
      where: { groupId, userId: { in: renewSet } },
      data:  { serviceInfo: null, extractionStartedAt: null, extractionNotificationId: null, extractionCommentId: null, serviceInfoIssueNote: null, serviceInfoIssueDeadline: null, confirmedAt: null, confirmDeadline: null, disputeDeadline: null, disputeEscalatedAt: null },
    });

    if (hasDropouts) {
      const leavingUserIds = leavingMembers.map(m => m.userId)
      await tx.member.deleteMany({ where: { groupId, userId: { in: leavingUserIds } } });
      await tx.subscription.deleteMany({ where: { groupId, userId: { in: leavingUserIds } } });
    }

    return tx.group.update({
      where: { id: groupId },
      data:  {
        status: nextStatus,
        currentMembers: renewingMembers.length,
        serviceInfoDeadline,
        escrowTokens: { increment: seatCost * renewSet.length },
        currentCycle: newCycle,
        billingDateAdjustedAt:     null,
        billingDateAdjustmentNote: null,
      },
      include: HOST_GROUP_INCLUDE,
    })
  })

  const groupLabel = groupLabelOf(group);

  if (leavingMembers.length > 0) {
    notifyBatch(leavingMembers.map(m => ({
      userId:  m.userId,
      type:    'member_removed',
      title:   `${groupLabel} 未列入新一期續訂名單`,
      message: `團主開始「${groupLabel}」新一期續訂時未將你列入名單，本期服務結束後將不再繼續，可以重新申請或選擇其他群組。`,
      meta:    { groupId },
    })))
  }

  if (hasDropouts) {
    notify({
      userId:  group.hostId,
      type:    'group_renewal',
      title:   `${groupLabel} 新一期已開始招募補位`,
      message: `「${groupLabel}」有成員這期不續訂，已釋出名額並退回招募中，補齊名額後請重新鎖定群組。`,
      meta:    { groupId },
    })
    notifyBatch(renewSet.map(userId => ({
      userId,
      type:    'group_renewal',
      title:   `${groupLabel} 新一期已開始`,
      message: `「${groupLabel}」開始新一期，團主正在補齊名額，補滿後會重新鎖定群組並通知你填寫最新帳號資訊。`,
      meta:    { groupId },
    })))
    return updated
  }

  notifyBatch(renewSet.map(userId => ({
    userId,
    type:    'group_renewal',
    title:   '新一期已開始',
    message: `「${groupLabel}」群組開始新一期，請前往填寫最新帳號資訊。`,
    meta:    { groupId },
  })))

  return updated
}
