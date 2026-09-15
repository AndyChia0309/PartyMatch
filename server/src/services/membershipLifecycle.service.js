import prisma from '../lib/prisma.js'
import { computeSeatCost } from '../utils/pricing.js'
import { notify, notifyBatch, claimGroupStatus } from '../routes/groups/shared.js'

function httpError(statusCode, message) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

export async function admitMemberIntoGroup(tx, { groupId, userId, seatCost, maxMembers, note }) {
  const applicant = await tx.user.findUnique({ where: { id: userId }, select: { tokenBalance: true } })
  if (!applicant || applicant.tokenBalance < seatCost) {
    throw httpError(400, 'PM幣餘額不足，無法加入')
  }

  const capacity = await tx.group.updateMany({
    where: { id: groupId, status: 'recruiting', currentMembers: { lt: maxMembers - 1 } },
    data:  { currentMembers: { increment: 1 }, escrowTokens: { increment: seatCost } },
  });
  if (capacity.count === 0) {
    throw httpError(409, '群組名額已滿或已結束招募，無法加入')
  }

  const [member] = await Promise.all([
    tx.member.upsert({
      where:  { groupId_userId: { groupId, userId } },
      create: { groupId, userId },
      update: {},
    }),
    tx.subscription.upsert({
      where:  { groupId_userId: { groupId, userId } },
      create: { groupId, userId },
      update: {},
    }),
    tx.user.update({ where: { id: userId }, data: { tokenBalance: { decrement: seatCost } } }),
  ])
  const currentGroup = await tx.group.findUnique({ where: { id: groupId }, select: { currentCycle: true } })
  await tx.tokenTransaction.create({
    data: { userId, type: 'escrow', amount: -seatCost, relatedGroupId: groupId, cycle: currentGroup?.currentCycle ?? 1, note },
  })

  await advanceToFullIfNeeded(tx, groupId)
  return member
}

export async function finalizeApprovedApplication(tx, { groupId, userId, maxMembers }) {
  const capacity = await tx.group.updateMany({
    where: { id: groupId, status: 'recruiting', currentMembers: { lt: maxMembers - 1 } },
    data:  { currentMembers: { increment: 1 } },
  });
  if (capacity.count === 0) {
    throw httpError(409, '群組名額已滿或已結束招募，無法加入')
  }

  const [member] = await Promise.all([
    tx.member.upsert({
      where:  { groupId_userId: { groupId, userId } },
      create: { groupId, userId },
      update: {},
    }),
    tx.subscription.upsert({
      where:  { groupId_userId: { groupId, userId } },
      create: { groupId, userId },
      update: {},
    }),
  ])

  await advanceToFullIfNeeded(tx, groupId)
  return member
}

async function advanceToFullIfNeeded(tx, groupId) {
  const updatedGroup = await tx.group.findUnique({
    where:  { id: groupId },
    select: { currentMembers: true, maxMembers: true, hostId: true, planName: true, service: { select: { name: true } } },
  });
  if (updatedGroup.currentMembers + 1 >= updatedGroup.maxMembers) {
    await tx.group.update({ where: { id: groupId }, data: { status: 'full' } })
    await rejectPendingApplications(tx, groupId, {
      refundNote: '群組名額已滿，代管退款',
      buildMessage: groupLabel => `很遺憾，「${groupLabel}」群組名額已滿，你的申請未通過，代管費用已退還至你的PM幣餘額，你可以繼續探索其他群組。`,
    })

    const groupLabel = updatedGroup.planName ?? updatedGroup.service?.name ?? ''
    notify({
      userId:  updatedGroup.hostId,
      type:    'group_full',
      title:   `${groupLabel} 群組名額已滿`,
      message: `「${groupLabel}」群組名額已滿，請前往鎖定群組。`,
      meta:    { groupId },
    });

    const existingMembers = await tx.member.findMany({ where: { groupId }, select: { userId: true } });
    const memberUserIds = existingMembers.map(m => m.userId)
    if (memberUserIds.length > 0) {
      notifyBatch(memberUserIds.map(userId => ({
        userId,
        type:    'group_full_member',
        title:   `${groupLabel} 群組名額已滿`,
        message: `「${groupLabel}」群組名額已滿，等待團主鎖定。`,
        meta:    { groupId },
      })))
    }
  }
}

export async function rejectPendingApplications(tx, groupId, { refundNote, buildMessage }) {
  const pendingApps = await tx.application.findMany({
    where:   { groupId, status: 'pending' },
    include: { group: { select: { perSeatMonthlyFee: true, billingCycle: true, planName: true, escrowTokens: true, service: { select: { name: true } } } } },
  })
  if (pendingApps.length === 0) return

  const groupLabel = pendingApps[0].group.planName ?? pendingApps[0].group.service?.name ?? ''
  let remainingEscrow = pendingApps[0].group.escrowTokens

  for (const app of pendingApps) {
    const escrowAmount = app.escrowAmount ?? computeSeatCost(app.group)
    const refundAmount = Math.min(escrowAmount, remainingEscrow)
    remainingEscrow -= refundAmount

    await tx.application.update({ where: { id: app.id }, data: { status: 'rejected', activeKey: null } })
    await refundEscrow(tx, { userId: app.userId, groupId, amount: refundAmount, note: refundNote })
  }

  notifyBatch(pendingApps.map(app => ({
    userId:  app.userId,
    type:    'application_rejected',
    title:   '申請未通過',
    message: buildMessage(groupLabel),
    meta:    { groupId, applicationId: app.id },
  })))
}

export async function refundEscrow(tx, { userId, groupId, amount, note }) {
  if (amount <= 0) return
  const [, group] = await Promise.all([
    tx.user.update({ where: { id: userId }, data: { tokenBalance: { increment: amount } } }),
    tx.group.update({ where: { id: groupId }, data: { escrowTokens: { decrement: amount } } }),
  ])
  await tx.tokenTransaction.create({
    data: { userId, type: 'refund', amount, relatedGroupId: groupId, cycle: group.currentCycle, note },
  })
}

export async function removeMember({ memberId, actorId }) {
  const existing = await prisma.member.findUnique({
    where:   { id: memberId },
    include: {
      group: { select: { id: true, hostId: true, planName: true, status: true, perSeatMonthlyFee: true, billingCycle: true, escrowTokens: true, currentMembers: true, service: { select: { name: true } } } },
      user:  { select: { name: true } },
    },
  })
  if (!existing) throw httpError(404, '成員不存在')

  const isHost = existing.group.hostId === actorId
  const isSelf = existing.userId === actorId
  if (!isHost && !isSelf) throw httpError(403, '無操作權限')

  if (!['recruiting', 'full'].includes(existing.group.status)) {
    throw httpError(400, '群組啟用後無法變更成員名單')
  }

  const seatCost = computeSeatCost(existing.group)
  const refundAmount = Math.min(seatCost, existing.group.escrowTokens)
  const newCount = existing.group.currentMembers - 1

  await prisma.$transaction(async (tx) => {
    await claimGroupStatus(tx, existing.groupId, {
      fromStatus: ['recruiting', 'full'],
      data:       { currentMembers: { decrement: 1 } },
      message:    '群組已被鎖定，無法變更成員名單，請重新整理頁面',
    })
    await tx.member.delete({ where: { id: memberId } })
    await tx.subscription.deleteMany({ where: { groupId: existing.groupId, userId: existing.userId } })
    await tx.group.updateMany({
      where: { id: existing.groupId, status: 'full' },
      data:  { status: 'recruiting' },
    })
    await refundEscrow(tx, {
      userId:  existing.userId,
      groupId: existing.groupId,
      amount:  refundAmount,
      note:    isHost ? '被團主移除，代管退款' : '自行退出，代管退款',
    })
    await tx.application.updateMany({
      where: { groupId: existing.groupId, userId: existing.userId, status: 'approved' },
      data:  { status: isHost ? 'removed' : 'left', activeKey: null },
    })
  })

  const groupLabel = existing.group.planName ?? existing.group.service?.name ?? ''
  if (isSelf) {
    notify({
      userId:  existing.group.hostId,
      type:    'member_left',
      title:   '成員已退出群組',
      message: `${existing.user?.name ?? '成員'} 已退出「${groupLabel}」群組。`,
      meta:    { groupId: existing.groupId },
    })
  } else {
    notify({
      userId:  existing.userId,
      type:    'member_removed',
      title:   '已被移出群組',
      message: `團主已將你移出「${groupLabel}」群組，代管費用已退還至你的PM幣餘額。`,
      meta:    { groupId: existing.groupId },
    })
  }

  return { currentMembers: newCount }
}
