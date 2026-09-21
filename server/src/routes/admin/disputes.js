import { Router } from 'express'
import prisma from '../../lib/prisma.js'
import { requireAdmin } from '../../middleware/auth.js'
import { maskAvatar } from '../../lib/avatarVisibility.js'
import { getSignedDownloadUrl } from '../../lib/r2Storage.js'
import { computeSeatCost } from '../../utils/pricing.js'

const router = Router()

const USER_SELECT = { id: true, name: true, avatarColor: true, avatarInitial: true, showAvatar: true, presenceStatus: true }

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const { status = 'pending', overdue, skip = '0', take = '20' } = req.query
    const where = {}
    if (status === 'pending') where.status = 'pending'
    else if (status === 'resolved') where.status = { in: ['resolved_by_host', 'adjudicated', 'resolved_by_resubmit'] }
    if (overdue === 'true') {
      where.status = 'pending'
      where.deadline = { lte: new Date() }
    }

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        raisedByUser: { select: { id: true, name: true } },
        group:        { select: { host: { select: { id: true, name: true } } } },
      },
      orderBy: { raisedAt: 'desc' },
      skip:    parseInt(skip),
      take:    parseInt(take),
    })

    res.json(disputes.map(d => ({
      id:             d.id,
      groupId:        d.groupId,
      memberId:       d.memberId,
      planName:       d.planNameSnapshot,
      hostId:         d.hostId,
      hostName:       d.group.host.name,
      memberUserId:   d.raisedByUserId,
      memberUserName: d.raisedByUser.name,
      reason:         d.reason,
      deadline:       d.deadline,
      raisedAt:       d.raisedAt,
      status:         d.status,
      resolutionType: d.resolutionType,
      hostDisputed:   d.hostDisputed,
    })))
  } catch (err) { next(err) }
});

router.get('/history', requireAdmin, async (req, res, next) => {
  try {
    const { groupId, raisedByUserId, resolutionType, skip = '0', take = '20' } = req.query
    const where = {
      status: { in: ['resolved_by_host', 'adjudicated', 'resolved_by_resubmit'] },
      ...(groupId &&         { groupId }),
      ...(raisedByUserId &&  { raisedByUserId }),
      ...(resolutionType &&  { resolutionType }),
    }

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        raisedByUser:    { select: { id: true, name: true } },
        resolvedByAdmin: { select: { id: true, name: true } },
        group:           { select: { host: { select: { id: true, name: true } } } },
      },
      orderBy: { resolvedAt: 'desc' },
      skip:    parseInt(skip),
      take:    parseInt(take),
    })

    res.json(disputes.map(d => ({
      id:                  d.id,
      groupId:             d.groupId,
      planName:            d.planNameSnapshot,
      hostName:            d.group.host.name,
      memberUserName:      d.raisedByUser.name,
      resolutionType:      d.resolutionType,
      memberRefundAmount:  d.memberRefundAmount,
      hostReleaseAmount:   d.hostReleaseAmount,
      resolutionNote:      d.resolutionNote,
      resolvedByAdminName: d.resolvedByAdmin?.name ?? null,
      raisedAt:            d.raisedAt,
      resolvedAt:          d.resolvedAt,
    })))
  } catch (err) { next(err) }
});

router.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const dispute = await prisma.dispute.findUnique({
      where:   { id: req.params.id },
      include: {
        raisedByUser:    { select: USER_SELECT },
        resolvedByAdmin: { select: { id: true, name: true } },
        group:           { select: { id: true, escrowTokens: true, perSeatMonthlyFee: true, billingCycle: true, host: { select: { id: true, name: true } } } },
      },
    })
    if (!dispute) return res.status(404).json({ message: '找不到申訴' })

    const seatCost = computeSeatCost(dispute.group)

    const [comments, conversation] = await Promise.all([
      prisma.credentialComment.findMany({
        where:   { groupId: dispute.groupId },
        include: { author: { select: USER_SELECT } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.conversation.findFirst({ where: { groupId: dispute.groupId, type: 'group' } }),
    ])

    const messages = conversation
      ? await prisma.message.findMany({
          where:   { conversationId: conversation.id },
          include: { sender: { select: USER_SELECT } },
          orderBy: { createdAt: 'asc' },
        })
      : []

    const [resolvedComments, resolvedMessages, evidenceUrl] = await Promise.all([
      Promise.all(comments.map(async c => ({
        ...c,
        author: maskAvatar(c.author),
        ...(c.attachmentUrl && { attachmentUrl: await getSignedDownloadUrl(c.attachmentUrl) }),
      }))),
      Promise.all(messages.map(async m => ({
        ...m,
        sender: m.sender ? maskAvatar(m.sender) : m.sender,
        ...(m.attachmentUrl && { attachmentUrl: await getSignedDownloadUrl(m.attachmentUrl) }),
      }))),
      dispute.evidenceUrl ? getSignedDownloadUrl(dispute.evidenceUrl) : null,
    ])

    res.json({
      id:                 dispute.id,
      groupId:            dispute.groupId,
      memberId:           dispute.memberId,
      planName:           dispute.planNameSnapshot,
      status:             dispute.status,
      reason:             dispute.reason,
      evidenceUrl,
      deadline:           dispute.deadline,
      raisedAt:           dispute.raisedAt,
      seatCost,
      escrowTokens:       dispute.group.escrowTokens,
      host:               dispute.group.host,
      member:             maskAvatar(dispute.raisedByUser),
      resolutionType:     dispute.resolutionType,
      resolvedByAdmin:    dispute.resolvedByAdmin,
      memberRefundAmount: dispute.memberRefundAmount,
      hostReleaseAmount:  dispute.hostReleaseAmount,
      resolutionNote:     dispute.resolutionNote,
      resolvedAt:         dispute.resolvedAt,
      hostDisputed:       dispute.hostDisputed,
      hostResponseNote:   dispute.hostResponseNote,
      hostRespondedAt:    dispute.hostRespondedAt,
      credentialComments: resolvedComments,
      conversationMessages: resolvedMessages,
    })
  } catch (err) { next(err) }
});

export default router
