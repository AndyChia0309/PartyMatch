import prisma from '../lib/prisma.js'
import { computeSeatCost } from '../utils/pricing.js'
import { finalizeApprovedApplication, refundEscrow } from './membershipLifecycle.service.js'
import { notify, claimGroupStatus } from '../routes/groups/shared.js'

function httpError(statusCode, message, responsePayload) {
  const err = new Error(message)
  err.statusCode = statusCode
  if (responsePayload) err.responsePayload = responsePayload
  return err
}

export async function submitApplication({ groupId, message, userId }) {
  const [group, applicant, lastDeparture, existing] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, include: { service: { select: { name: true } } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { tokenBalance: true, creditScore: true, name: true } }),
    prisma.application.findFirst({ where: { groupId, userId, status: { in: ['removed', 'left', 'cancelled'] } }, orderBy: { updatedAt: 'desc' } }),
    prisma.application.findFirst({ where: { groupId, userId }, orderBy: { createdAt: 'desc' } }),
  ])
  if (!group) throw httpError(404, '群組不存在')
  if (group.status !== 'recruiting') throw httpError(400, '此群組目前不開放申請')
  if (group.hostId === userId) throw httpError(400, '團主不能申請自己的群組')

  if (lastDeparture) {
    const cooldownEnds = new Date(lastDeparture.updatedAt)
    cooldownEnds.setMinutes(cooldownEnds.getMinutes() + 1)
    if (cooldownEnds > new Date()) {
      const reason = lastDeparture.status === 'left'
        ? '先前退出這個群組'
        : lastDeparture.status === 'cancelled'
          ? '先前取消了對這個群組的申請'
          : '先前被移出這個群組'
      throw httpError(400, `你${reason}，需等到 ${cooldownEnds.toISOString()} 才能重新申請`, {
        code:         'REAPPLY_COOLDOWN',
        cooldownEnds: cooldownEnds.toISOString(),
      })
    }
  }

  if ((applicant?.creditScore ?? 0) < group.minCreditScore) {
    throw httpError(400, `信用分數不足，此群組需 ${group.minCreditScore} 分以上（目前 ${applicant?.creditScore ?? 0} 分）`, {
      code:     'CREDIT_SCORE_TOO_LOW',
      required: group.minCreditScore,
    })
  }

  const seatCost = computeSeatCost(group)
  if ((applicant?.tokenBalance ?? 0) < seatCost) {
    throw httpError(400, `PM幣餘額不足，需要 ${seatCost} PM（目前 ${applicant?.tokenBalance ?? 0} PM）`, {
      code:     'INSUFFICIENT_BALANCE',
      required: seatCost,
    })
  }

  if (existing && !['rejected', 'removed', 'left', 'cancelled'].includes(existing.status)) {
    throw httpError(409, '你已有一筆進行中的申請')
  }

  let application
  try {
    application = await prisma.$transaction(async (tx) => {
      const charged = await tx.user.updateMany({
        where: { id: userId, tokenBalance: { gte: seatCost } },
        data:  { tokenBalance: { decrement: seatCost } },
      })
      if (charged.count === 0) {
        throw httpError(400, `PM幣餘額不足，需要 ${seatCost} PM`, { code: 'INSUFFICIENT_BALANCE', required: seatCost })
      }

      await claimGroupStatus(tx, groupId, {
        fromStatus:   'recruiting',
        data:         { escrowTokens: { increment: seatCost } },
        message:      '此群組剛好被團主解散或已額滿，無法申請',
        responseCode: 'GROUP_NOT_RECRUITING',
      })

      const created = await tx.application.create({
        data: { groupId, userId, message, activeKey: 'active', escrowAmount: seatCost },
      })

      await tx.tokenTransaction.create({
        data: { userId, type: 'escrow', amount: -seatCost, relatedGroupId: groupId, cycle: group.currentCycle, note: `申請加入群組代管 ${seatCost} PM` },
      })

      return created
    })
  } catch (err) {
    if (err.code === 'P2002') throw httpError(409, '你已有一筆進行中的申請')
    if (err.responseCode) throw httpError(err.statusCode ?? 409, err.message, { code: err.responseCode })
    throw err
  }

  const groupLabel = group.planName ?? group.service?.name ?? ''
  notify({
    userId,
    type:    'application_sent',
    title:   `${groupLabel} 申請已送出`,
    message: `你的加入申請已送達「${groupLabel}」團主，等待審核。`,
    meta:    { groupId, applicationId: application.id },
  })
  notify({
    userId:  group.hostId,
    type:    'new_application',
    title:   `${groupLabel} ${applicant?.name ?? '有人'}提出申請`,
    message: `${applicant?.name ?? '有人'} 申請加入「${groupLabel}」群組。`,
    meta:    { groupId, applicationId: application.id },
  })

  return application
}

export async function cancelApplication({ applicationId, userId }) {
  const application = await prisma.application.findUnique({
    where:   { id: applicationId },
    include: {
      group: { select: { id: true, hostId: true, planName: true, perSeatMonthlyFee: true, billingCycle: true, escrowTokens: true, service: { select: { name: true } } } },
      user:  { select: { name: true } },
    },
  })
  if (!application) throw httpError(404, '申請不存在')
  if (application.userId !== userId) throw httpError(403, '僅申請人可取消')
  if (application.status !== 'pending') throw httpError(400, '只能取消審核中的申請')

  const escrowAmount = application.escrowAmount ?? computeSeatCost(application.group)
  const refundAmount = Math.min(escrowAmount, application.group.escrowTokens)

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.application.updateMany({
      where: { id: applicationId, status: 'pending' },
      data:  { status: 'cancelled', activeKey: null },
    })
    if (claimed.count === 0) throw httpError(409, '此申請已被處理，請重新整理頁面')

    await refundEscrow(tx, { userId, groupId: application.groupId, amount: refundAmount, note: '取消申請，代管退款' })

    return tx.application.findUnique({ where: { id: applicationId } })
  })

  const groupLabel = application.group.planName ?? application.group.service?.name ?? ''
  notify({
    userId:  application.group.hostId,
    type:    'application_cancelled',
    title:   `${groupLabel} ${application.user?.name ?? '申請人'}已取消申請`,
    message: `${application.user?.name ?? '申請人'} 已取消加入「${groupLabel}」群組的申請。`,
    meta:    { groupId: application.groupId, applicationId },
  })

  return updated
}

export async function reviewApplication({ applicationId, hostId, status }) {
  const application = await prisma.application.findUnique({
    where:   { id: applicationId },
    include: { group: { select: { hostId: true, planName: true, perSeatMonthlyFee: true, billingCycle: true, escrowTokens: true, service: { select: { name: true } } } } },
  })
  if (!application) throw httpError(404, '申請不存在')
  if (application.group.hostId !== hostId) throw httpError(403, '僅團主可審核')

  const groupLabel = application.group.planName ?? application.group.service?.name ?? ''

  if (status !== 'approved') {
    const escrowAmount = application.escrowAmount ?? computeSeatCost(application.group)
    const refundAmount = Math.min(escrowAmount, application.group.escrowTokens)

    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.application.updateMany({
        where: { id: applicationId, status: 'pending' },
        data:  { status, activeKey: null },
      })
      if (claimed.count > 0) {
        await refundEscrow(tx, { userId: application.userId, groupId: application.groupId, amount: refundAmount, note: '申請未通過，代管退款' })
      } else {
        await tx.application.update({ where: { id: applicationId }, data: { status, activeKey: null } })
      }
      return tx.application.findUnique({ where: { id: applicationId } })
    })

    if (status === 'rejected') {
      notify({
        userId:  application.userId,
        type:    'application_rejected',
        title:   `${groupLabel} 申請未通過`,
        message: `很遺憾，你加入「${groupLabel}」群組的申請未通過，代管費用已退還至你的PM幣餘額，你可以繼續探索其他群組。`,
        meta:    { groupId: application.groupId, applicationId },
      })
    }

    return updated
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.application.updateMany({
      where: { id: applicationId, status: 'pending' },
      data:  { status: 'approved' },
    })
    if (claimed.count === 0) throw httpError(409, '此申請已被處理，請重新整理頁面')

    const group = await tx.group.findUnique({ where: { id: application.groupId }, select: { maxMembers: true } })
    if (!group) throw httpError(404, '群組不存在')

    await finalizeApprovedApplication(tx, { groupId: application.groupId, userId: application.userId, maxMembers: group.maxMembers })

    return tx.application.findUnique({ where: { id: applicationId } })
  })

  notify({
    userId:  application.userId,
    type:    'application_approved',
    title:   `${groupLabel} 申請已通過`,
    message: `恭喜！你加入「${groupLabel}」群組的申請已通過，請前往我的訂閱查看。`,
    meta:    { groupId: application.groupId, applicationId },
  })

  return updated
}
