import { Router } from 'express'
import { z } from 'zod'
import prisma from '../../lib/prisma.js'
import redis from '../../lib/redis.js'
import { requireAuth, optionalAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { notify, notifyBatch } from './shared.js'
import { maskAvatar } from '../../lib/avatarVisibility.js'
import { maskGroupListSensitiveFields, maskGroupDetailSensitiveFields, resolveGroupMemberEvidenceUrls, HOST_PUBLIC_SELECT } from '../../lib/groupPrivacy.js'
import { computeSeatCost, toPlainGroup } from '../../utils/pricing.js'
import { allMembersSettled } from '../../services/groupLifecycle.service.js'

const router = Router()

function maskGroupAvatars(group) {
  return toPlainGroup({
    ...group,
    ...(group.host && { host: maskAvatar(group.host) }),
    ...(group.members && { members: group.members.map(m => ({ ...m, user: maskAvatar(m.user) })) }),
  })
}

function groupLabelOf(group) {
  return group.planName ?? group.service?.name ?? ''
}

function httpError(statusCode, message) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

const createGroupSchema = z.object({
  serviceId:      z.string().min(1),
  planName:       z.string().min(1),
  rules:          z.union([z.string(), z.array(z.string())]).optional(),
  tags:           z.array(z.string()).optional(),
  minCreditScore: z.number().int().min(0).default(0),
  minGroupAge:    z.number().int().min(0).default(0),
  maxMembers:     z.number().int().min(2).optional(),
}).transform(data => ({
  ...data,
  rules: Array.isArray(data.rules) ? data.rules.join('\n') : (data.rules ?? ''),
  tags:  data.tags ?? [],
}));

const updateGroupSchema = z.object({
  status:          z.enum(['recruiting','full','pending_confirmation','info_overdue','pending_activation','activation_overdue','active','confirming','disputed','replacement_recruiting','cancelled','ended']).optional(),
  billingCycle:    z.enum(['monthly', 'yearly']).optional(),
  nextBillingDate: z.string().optional(),
})

const GROUP_LIST_SERVICE_SELECT = { id: true, name: true, category: true, logoUrl: true };

const PAYMENT_REMINDER_WINDOW_DAYS = 7;

async function remindInsufficientBalanceMembers(group) {
  if (group.status !== 'active' || !group.nextBillingDate) return null

  const daysUntilBilling = Math.ceil((new Date(group.nextBillingDate) - new Date()) / (24 * 60 * 60 * 1000))
  if (daysUntilBilling < 0 || daysUntilBilling > PAYMENT_REMINDER_WINDOW_DAYS) return null

  const seatCost = computeSeatCost(group)
  const members = await prisma.member.findMany({
    where:  { groupId: group.id },
    select: { userId: true, user: { select: { tokenBalance: true } } },
  })
  const insufficient = members.filter(m => m.user.tokenBalance < seatCost)
  if (insufficient.length === 0) return []

  const nextBillingDateStr = new Date(group.nextBillingDate).toISOString();

  const lockKey = `payment-reminder-lock:${group.id}:${nextBillingDateStr}`;
  const acquiredLock = await redis.set(lockKey, '1', 'EX', 60, 'NX').catch(() => null)
  if (acquiredLock) {
    const existing = await prisma.notification.findMany({
      where:   { userId: { in: insufficient.map(m => m.userId) }, type: 'payment_reminder' },
      orderBy: { createdAt: 'desc' },
      select:  { userId: true, meta: true },
    })
    const lastNotifiedAt = new Map()
    for (const n of existing) {
      if (n.meta?.groupId !== group.id) continue
      if (!lastNotifiedAt.has(n.userId)) lastNotifiedAt.set(n.userId, n.meta?.nextBillingDate)
    }
    const toNotify = insufficient.filter(m => lastNotifiedAt.get(m.userId) !== nextBillingDateStr)

    if (toNotify.length > 0) {
      const groupLabel = groupLabelOf(group)
      notifyBatch(toNotify.map(m => ({
        userId:  m.userId,
        type:    'payment_reminder',
        title:   `${groupLabel} 下一期扣款餘額不足`,
        message: `「${groupLabel}」即將於 ${nextBillingDateStr.slice(0, 10)} 扣款，你的PM幣餘額不足，請儘快儲值以免影響續訂。`,
        meta:    { groupId: group.id, nextBillingDate: nextBillingDateStr },
      }))).catch(console.error)
    }
  }

  return insufficient.map(m => m.userId)
}

const GROUP_LIST_CACHE_TTL_SECONDS = 20;

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { serviceId, category, status = 'recruiting', q } = req.query
    const cacheKey = `groups:list:${JSON.stringify({ serviceId: serviceId ?? '', category: category ?? '', status, q: q ?? '' })}`

    const cached = await redis.get(cacheKey).catch(() => null)
    if (cached) {
      res.json(JSON.parse(cached))
      return
    }

    const statusFilter = status === 'recruiting' ? { in: ['recruiting', 'replacement_recruiting'] } : status

    const groups = await prisma.group.findMany({
      where: {
        ...(status !== 'all' && { status: statusFilter }),
        ...(serviceId && { serviceId }),
        ...(q && {
          OR: [
            { service: { name: { contains: q } } },
            { planName:  { contains: q } },
          ],
        }),
        ...(category && { service: { category } }),
      },
      include: {
        host:    HOST_PUBLIC_SELECT,
        service: { select: GROUP_LIST_SERVICE_SELECT },
        _count:  { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const payload = maskGroupListSensitiveFields(groups.map(maskGroupAvatars))
    redis.setex(cacheKey, GROUP_LIST_CACHE_TTL_SECONDS, JSON.stringify(payload)).catch(() => {})
    res.json(payload)
  } catch (err) { next(err) }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        host:    HOST_PUBLIC_SELECT,
        service: true,
        members: {
          include: { user: { select: { id: true, name: true, avatarColor: true, avatarInitial: true, showAvatar: true, presenceStatus: true, bio: true } } },
        },
      },
    })
    if (!group) return res.status(404).json({ message: '群組不存在' })

    if (group.status === 'confirming' && allMembersSettled(group.members)) {
      const released = await prisma.$transaction(async (tx) => {
        const fresh = await tx.group.findUnique({ where: { id: group.id }, select: { status: true, escrowTokens: true } })
        if (fresh?.status !== 'confirming')
          return false;
        const claimed = await tx.group.updateMany({
          where: { id: group.id, status: 'confirming' },
          data:  { status: 'active', escrowTokens: 0 },
        });
        if (claimed.count === 0)
          return false;
        await tx.user.update({ where: { id: group.hostId }, data: { tokenBalance: { increment: fresh.escrowTokens } } })
        await tx.tokenTransaction.create({
          data: { userId: group.hostId, type: 'release', amount: fresh.escrowTokens, relatedGroupId: group.id, cycle: group.currentCycle, note: '確認期逾期，自動撥款' },
        })
        await tx.subscription.updateMany({ where: { groupId: group.id }, data: { status: 'active' } })
        return true
      })
      if (released) {
        const groupLabel = groupLabelOf(group)
        notify({
          userId:  group.hostId,
          type:    'escrow_released',
          title:   `${groupLabel} 代管款項已撥款`,
          message: `「${groupLabel}」確認期已逾期，代管款項已自動撥入你的PM幣餘額。`,
          meta:    { groupId: group.id },
        })
      }
      return res.json(await resolveGroupMemberEvidenceUrls(maskGroupDetailSensitiveFields(maskGroupAvatars({ ...group, status: 'active', escrowTokens: 0 }), req.user?.id)))
    }

    if (group.status === 'pending_confirmation' && group.serviceInfoDeadline && new Date(group.serviceInfoDeadline) <= new Date()) {
      const claimed = await prisma.group.updateMany({
        where: { id: group.id, status: 'pending_confirmation', serviceInfoDeadline: { lte: new Date() } },
        data:  { status: 'info_overdue' },
      });
      if (claimed.count > 0) {
        const groupLabel = groupLabelOf(group)
        notify({
          userId:  group.hostId,
          type:    'service_info_deadline_passed',
          title:   `${groupLabel} 服務資訊已逾期，請前往處理`,
          message: `「${groupLabel}」群組有成員逾期未完成帳號資訊填寫，請前往延長期限或協助處理，尚未完成的成員不會被自動移除。`,
          meta:    { groupId: group.id },
        })
        const fresh = await prisma.group.findUnique({
          where: { id: group.id },
          include: {
            host:    HOST_PUBLIC_SELECT,
            service: true,
            members: { include: { user: { select: { id: true, name: true, avatarColor: true, avatarInitial: true, showAvatar: true, presenceStatus: true, bio: true } } } },
          },
        })
        return res.json(await resolveGroupMemberEvidenceUrls(maskGroupDetailSensitiveFields(maskGroupAvatars(fresh), req.user?.id)))
      }
    }

    if (group.status === 'pending_activation' && group.activateDeadline && new Date(group.activateDeadline) <= new Date()) {
      const claimed = await prisma.group.updateMany({
        where: { id: group.id, status: 'pending_activation', activateDeadline: { lte: new Date() } },
        data:  { status: 'activation_overdue' },
      });
      if (claimed.count > 0) {
        notify({
          userId:  group.hostId,
          type:    'group_activation_expired',
          title:   `${groupLabelOf(group)} 逾時未啟用服務`,
          message: `「${groupLabelOf(group)}」逾期未手動啟用，請盡快點擊啟用服務，成員也可以確認服務是否已可使用或回報問題。`,
          meta:    { groupId: group.id },
        })
        const fresh = await prisma.group.findUnique({
          where: { id: group.id },
          include: {
            host:    HOST_PUBLIC_SELECT,
            service: true,
            members: { include: { user: { select: { id: true, name: true, avatarColor: true, avatarInitial: true, showAvatar: true, presenceStatus: true, bio: true } } } },
          },
        })
        return res.json(await resolveGroupMemberEvidenceUrls(maskGroupDetailSensitiveFields(maskGroupAvatars(fresh), req.user?.id)))
      }
    }

    if (req.user?.id === group.hostId) {
      const insufficientUserIds = await remindInsufficientBalanceMembers(group).catch(err => { console.error(err); return null })
      if (insufficientUserIds !== null) {
        const insufficientSet = new Set(insufficientUserIds)
        group.members = group.members.map(m => ({ ...m, hasSufficientBalanceForRenewal: !insufficientSet.has(m.userId) }))
      }
    }

    res.json(await resolveGroupMemberEvidenceUrls(maskGroupDetailSensitiveFields(maskGroupAvatars(group), req.user?.id)))
  } catch (err) { next(err) }
});

async function resolvePlanPricing(serviceId, planName) {
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { plans: true } })
  if (!service) return null
  const plan = service.plans.find(p => p.name === planName)
  if (!plan) return null
  const maxMembers = Number(plan.maxMembers ?? plan.maxSeats)
  const totalMonthlyFee = Number(plan.totalMonthlyFee ?? plan.monthlyFee ?? plan.monthlyPrice)
  if (!Number.isFinite(maxMembers) || maxMembers < 2 || !Number.isFinite(totalMonthlyFee) || totalMonthlyFee <= 0) return null
  return {
    planId:          plan.id,
    planName:        plan.name,
    maxMembers,
    totalMonthlyFee,
    currency:        plan.currency ?? 'TWD',
    billingCycle:    plan.name.includes('年繳') ? 'yearly' : 'monthly',
  }
}

router.post('/', requireAuth, validate(createGroupSchema), async (req, res, next) => {
  try {
    const pricing = await resolvePlanPricing(req.body.serviceId, req.body.planName)
    if (!pricing) return res.status(400).json({ message: '找不到對應的服務方案' })

    let maxMembers = pricing.maxMembers
    if (req.body.maxMembers != null) {
      if (req.body.maxMembers < 2 || req.body.maxMembers > pricing.maxMembers) {
        return res.status(400).json({ message: `開放名額需介於 2 至 ${pricing.maxMembers} 人` })
      }
      maxMembers = req.body.maxMembers
    }

    const perSeatMonthlyFee = Math.ceil(pricing.totalMonthlyFee / maxMembers)

    const allowed = ['serviceId','rules','tags','minCreditScore','minGroupAge'];
    const data = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))

    const group = await prisma.$transaction(async (tx) => {
      // 鎖住這個使用者的 row，讓同一人同時送出的多個建立群組請求排隊處理，
      // 避免兩個請求都在對方寫入前查到「目前 0 個進行中群組」而同時通過檢查
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.id} FOR UPDATE`

      const existingSameServiceGroup = await tx.group.findFirst({
        where: {
          hostId:    req.user.id,
          serviceId: req.body.serviceId,
          status:    { notIn: ['cancelled', 'ended'] },
        },
        select: { id: true },
      })
      if (existingSameServiceGroup) {
        const err = httpError(400, '已經有此服務的群組')
        err.responsePayload = { groupId: existingSameServiceGroup.id }
        throw err
      }

      return tx.group.create({
        data: {
          ...data,
          planId:       pricing.planId,
          planName:     pricing.planName,
          currency:     pricing.currency,
          billingCycle: pricing.billingCycle,
          perSeatMonthlyFee,
          maxMembers,
          hostId: req.user.id,
        },
        include: { service: true, host: HOST_PUBLIC_SELECT },
      })
    })

    notify({
      userId:  req.user.id,
      type:    'group_created',
      title:   `${groupLabelOf(group)} 群組已成功建立`,
      message: `「${groupLabelOf(group)}」群組已上架，開始招募成員中！`,
      meta:    { groupId: group.id },
    })

    res.status(201).json(maskGroupAvatars(group))
  } catch (err) { next(err) }
});

const ALLOWED_TRANSITIONS = {
  recruiting:           ['full', 'cancelled'],
  full:                 ['recruiting', 'pending_confirmation', 'cancelled'],
  pending_confirmation: ['pending_activation'],
  pending_activation:   ['active'],
  active:               ['confirming', 'ended', 'pending_confirmation'],
  confirming:           ['active', 'disputed', 'cancelled'],
  disputed:             ['confirming', 'active', 'cancelled', 'ended'],
  cancelled:            [],
  ended:                [],
}

router.patch('/:id', requireAuth, validate(updateGroupSchema), async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: { members: true, service: { select: { name: true } } },
    })
    if (!group) return res.status(404).json({ message: '群組不存在' })
    if (group.hostId !== req.user.id) return res.status(403).json({ message: '僅團主可操作' })

    const { status } = req.body
    if (status && status !== group.status) {
      const allowed = ALLOWED_TRANSITIONS[group.status] ?? []
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: `不允許從 ${group.status} 轉換為 ${status}` })
      }
    }

    const updated = await prisma.group.update({
      where: { id: req.params.id },
      data:  req.body,
    })

    if (status === 'ended' && group.status !== 'ended') {
      const groupLabel = groupLabelOf(group)
      await notifyBatch(group.members.map(m => ({
        userId:  m.userId,
        type:    'group_ended',
        title:   `${groupLabel} 群組已結束`,
        message: `「${groupLabel}」群組已由團主結束，合購服務將不再續訂。`,
        meta:    { groupId: req.params.id },
      })))
    }

    res.json(toPlainGroup(updated))
  } catch (err) { next(err) }
});

router.get('/:id/transactions', requireAuth, async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: req.params.id }, select: { hostId: true } })
    if (!group) return res.status(404).json({ message: '群組不存在' })
    if (group.hostId !== req.user.id) return res.status(403).json({ message: '僅團主可查看' })

    const transactions = await prisma.tokenTransaction.findMany({
      where:   { relatedGroupId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, avatarInitial: true, avatarColor: true, showAvatar: true, presenceStatus: true } } },
    })
    res.json(transactions.map(t => ({ ...t, user: maskAvatar(t.user) })))
  } catch (err) { next(err) }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: req.params.id } })
    if (!group) return res.status(404).json({ message: '群組不存在' })
    if (group.hostId !== req.user.id) return res.status(403).json({ message: '僅團主可操作' })
    if (group.status !== 'recruiting' || group.currentMembers > 0) {
      return res.status(400).json({ message: '群組已有成員加入或已鎖定，請改用解散群組功能' })
    }

    await prisma.notification.deleteMany({ where: { groupId: req.params.id } });
    await prisma.group.delete({ where: { id: req.params.id } })
    res.status(204).end()
  } catch (err) { next(err) }
});

export default router
