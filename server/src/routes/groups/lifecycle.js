import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireAdmin } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { adjudicateLimiter } from '../../middleware/rateLimit.js'
import { toPlainGroup } from '../../utils/pricing.js'
import { maskAvatar } from '../../lib/avatarVisibility.js'
import * as groupLifecycleService from '../../services/groupLifecycle.service.js'

const router = Router()

function maskGroupHost(group) {
  return toPlainGroup(group?.host ? { ...group, host: maskAvatar(group.host) } : group)
}

const disputeSchema = z.object({
  reason:      z.string().trim().min(1).max(500),
  evidenceUrl: z.string().min(1),
})

const adjustBillingDateSchema = z.object({
  nextBillingDate: z.string(),
  note:            z.string().trim().min(1).max(300),
})

const resolveDisputeSchema = z.object({
  memberId: z.string().min(1),
  note:     z.string().trim().max(500).optional(),
})

const escalateDisputeSchema = z.object({
  memberId: z.string().min(1),
  note:     z.string().trim().min(1).max(500),
})

const adjudicateSchema = z.object({
  memberId: z.string().min(1),
  winner:   z.enum(['member', 'host']),
  reason:   z.string().trim().min(1).max(500),
})

const activateGroupSchema = z.object({
  nextBillingDate: z.string().optional(),
})

router.post('/:id/activate', requireAuth, validate(activateGroupSchema), async (req, res, next) => {
  try {
    const updated = await groupLifecycleService.activateGroup({
      groupId: req.params.id,
      hostId:  req.user.id,
      nextBillingDate: req.body.nextBillingDate,
    })
    res.json(maskGroupHost(updated))
  } catch (err) { next(err) }
});

router.patch('/:id/billing-date', requireAuth, validate(adjustBillingDateSchema), async (req, res, next) => {
  try {
    const updated = await groupLifecycleService.adjustBillingDate({
      groupId: req.params.id,
      hostId:  req.user.id,
      nextBillingDate: req.body.nextBillingDate,
      note:            req.body.note,
    })
    res.json(maskGroupHost(updated))
  } catch (err) { next(err) }
});

router.post('/:id/confirm', requireAuth, async (req, res, next) => {
  try {
    const { group, released } = await groupLifecycleService.confirmService({ groupId: req.params.id, userId: req.user.id })
    res.json({ group: group ? maskGroupHost(group) : null, released })
  } catch (err) { next(err) }
});

router.post('/:id/dispute', requireAuth, validate(disputeSchema), async (req, res, next) => {
  try {
    const updated = await groupLifecycleService.raiseDispute({
      groupId:     req.params.id,
      userId:      req.user.id,
      reason:      req.body.reason,
      evidenceUrl: req.body.evidenceUrl,
    })
    res.json(maskGroupHost(updated))
  } catch (err) { next(err) }
});

router.post('/:id/dispute/withdraw', requireAuth, async (req, res, next) => {
  try {
    const updated = await groupLifecycleService.withdrawDispute({
      groupId: req.params.id,
      userId:  req.user.id,
    })
    res.json(maskGroupHost(updated))
  } catch (err) { next(err) }
});

router.post('/:id/resolve-dispute', requireAuth, validate(resolveDisputeSchema), async (req, res, next) => {
  try {
    const updated = await groupLifecycleService.resolveDisputeByHost({
      groupId:  req.params.id,
      hostId:   req.user.id,
      memberId: req.body.memberId,
      note:     req.body.note,
    })
    res.json(maskGroupHost(updated))
  } catch (err) { next(err) }
});

router.post('/:id/escalate-dispute', requireAuth, validate(escalateDisputeSchema), async (req, res, next) => {
  try {
    const updated = await groupLifecycleService.escalateDisputeToAdmin({
      groupId:  req.params.id,
      hostId:   req.user.id,
      memberId: req.body.memberId,
      note:     req.body.note,
    })
    res.json(maskGroupHost(updated))
  } catch (err) { next(err) }
});

router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const result = await groupLifecycleService.cancelGroup({ groupId: req.params.id, hostId: req.user.id })
    res.json(result)
  } catch (err) { next(err) }
});

router.post('/:id/lock', requireAuth, async (req, res, next) => {
  try {
    const updated = await groupLifecycleService.lockGroup({
      groupId:  req.params.id,
      hostId:   req.user.id,
      sharedCredentials: req.body?.sharedCredentials,
    })
    res.json(maskGroupHost(updated))
  } catch (err) { next(err) }
});

router.post('/:id/adjudicate', requireAdmin, adjudicateLimiter, validate(adjudicateSchema), async (req, res, next) => {
  try {
    const result = await groupLifecycleService.adjudicateDispute({
      groupId:  req.params.id,
      adminId:  req.admin.id,
      memberId: req.body.memberId,
      winner:   req.body.winner,
      reason:   req.body.reason,
    })
    res.json(result)
  } catch (err) { next(err) }
});

router.post('/:id/renew', requireAuth, async (req, res, next) => {
  try {
    const updated = await groupLifecycleService.renewGroup({ groupId: req.params.id, hostId: req.user.id, renewingUserIds: req.body.renewingUserIds })
    res.json(maskGroupHost(updated))
  } catch (err) {
    if (err.code === 'INSUFFICIENT_BALANCE') {
      return res.status(err.statusCode).json({ message: err.message, code: err.code, memberIds: err.memberIds })
    }
    next(err)
  }
});

export default router
