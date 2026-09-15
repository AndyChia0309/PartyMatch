import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { notifyBatch } from './groups/shared.js'

const router = Router()

const updateSubscriptionSchema = z.object({
  status:          z.enum(['pending', 'active', 'ended']).optional(),
  nextBillingDate: z.string().optional(),
})

async function notifyUpcomingRenewals(subscriptions, userId) {
  const candidates = subscriptions
    .filter(s => s.userId === userId && s.status === 'active' && s.group.status === 'active' && s.nextBillingDate)
    .map(s => ({ ...s, days: Math.ceil((new Date(s.nextBillingDate).getTime() - Date.now()) / 86400000) }))
    .filter(s => s.days >= 0 && s.days <= 7)
  if (candidates.length === 0) return

  const alreadySent = await prisma.notification.findMany({
    where: { userId, type: 'upcoming_renewal' },
    orderBy: { createdAt: 'desc' },
  });
  const alreadySentByGroupId = new Map()
  for (const n of alreadySent) {
    const groupId = n.meta?.groupId
    if (groupId && !alreadySentByGroupId.has(groupId))
      alreadySentByGroupId.set(groupId, n);
  }

  const toCreate = candidates.filter(sub => {
    const sent = alreadySentByGroupId.get(sub.groupId)
    return sent?.meta?.nextBillingDate !== sub.nextBillingDate.toISOString()
  })
  if (toCreate.length === 0) return

  await notifyBatch(toCreate.map(sub => ({
    userId,
    type:    'upcoming_renewal',
    title:   `${sub.group.planName ?? sub.group.service?.name ?? ''} 即將續訂`,
    message: `「${sub.group.service?.name ?? sub.group.planName}」將於 ${sub.days === 0 ? '今天' : `${sub.days} 天後`}扣款，請確認PM幣餘額充足。`,
    meta:    { groupId: sub.groupId, nextBillingDate: sub.nextBillingDate.toISOString() },
  })))
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.query
    const scope = {
      OR: [
        { userId: req.user.id },
        { group: { hostId: req.user.id } },
      ],
    }
    const subscriptions = await prisma.subscription.findMany({
      where: groupId ? { AND: [scope, { groupId }] } : scope,
      include: {
        group: { include: { service: true, host: { select: { id: true, name: true } } } },
        user:  { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    notifyUpcomingRenewals(subscriptions, req.user.id).catch(console.error)
    res.json(subscriptions)
  } catch (err) { next(err) }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where:   { id: req.params.id },
      include: { group: { select: { hostId: true } } },
    })
    if (!sub) return res.status(404).json({ message: '訂閱不存在' })

    const isOwner = sub.userId === req.user.id
    const isHost  = sub.group.hostId === req.user.id
    if (!isOwner && !isHost) return res.status(403).json({ message: '無操作權限' })

    await prisma.subscription.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
});

router.patch('/:id', requireAuth, validate(updateSubscriptionSchema), async (req, res, next) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { group: true },
    })
    if (!sub) return res.status(404).json({ message: '訂閱不存在' })

    const isOwner = sub.userId === req.user.id
    const isHost  = sub.group.hostId === req.user.id
    if (!isOwner && !isHost) return res.status(403).json({ message: '無操作權限' })

    const updated = await prisma.subscription.update({
      where: { id: req.params.id },
      data:  req.body,
    })
    res.json(updated)
  } catch (err) { next(err) }
});

export default router
