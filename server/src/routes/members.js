import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { computeSeatCost } from '../utils/pricing.js'
import { admitMemberIntoGroup, removeMember } from '../services/membershipLifecycle.service.js'
import { maskAvatar } from '../lib/avatarVisibility.js'
import { maskMemberSensitiveFields, resolveMemberEvidenceUrls, resolveMembersEvidenceUrls } from '../lib/groupPrivacy.js'
import { notify, claimGroupStatus } from './groups/shared.js'

const router = Router()

const addMemberSchema = z.object({
  groupId: z.string().min(1),
  userId:  z.string().min(1),
})

const patchMemberSchema = z.object({
  serviceInfo:                 z.any().optional(),
  serviceInfoIssueNote:        z.string().nullable().optional(),
  serviceInfoIssueEvidenceUrl: z.string().nullable().optional(),
})

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.query
    let where
    if (groupId) {
      const isMember = await prisma.member.findFirst({ where: { groupId, userId: req.user.id } });
      const isHost   = isMember ? null : await prisma.group.findFirst({ where: { id: groupId, hostId: req.user.id } })
      if (!isMember && !isHost) return res.status(403).json({ message: '無權限查看此群組成員' })
      where = { groupId }
    } else {
      where = {
        OR: [
          {
            group: { members: { some: { userId: req.user.id } } }
          },
          {
            group: { hostId: req.user.id }
          },
        ],
      }
    }
    const members = await prisma.member.findMany({
      where,
      include: {
        user:  { select: { id: true, name: true, avatarColor: true, avatarInitial: true, showAvatar: true, presenceStatus: true, bio: true } },
        group: { select: { hostId: true } },
      },
      orderBy: { joinedAt: 'asc' },
    })
    const masked = members.map(({ group, ...m }) => ({
      ...maskMemberSensitiveFields(m, { isHost: group.hostId === req.user.id, isSelf: m.userId === req.user.id }),
      user: maskAvatar(m.user),
    }));
    res.json(await resolveMembersEvidenceUrls(masked));
  } catch (err) { next(err) }
});

router.post('/', requireAuth, validate(addMemberSchema), async (req, res, next) => {
  try {
    const { groupId, userId } = req.body
    const [group, targetUser] = await Promise.all([
      prisma.group.findUnique({ where: { id: groupId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    ])
    if (!group) return res.status(404).json({ message: '群組不存在' })
    if (group.hostId !== req.user.id) return res.status(403).json({ message: '僅團主可操作' })
    if (group.status !== 'recruiting') return res.status(400).json({ message: '群組非招募中，無法手動加入成員' })
    if (!targetUser) return res.status(404).json({ message: '使用者不存在' })

    const seatCost = computeSeatCost(group)

    const member = await prisma.$transaction(tx => admitMemberIntoGroup(tx, {
      groupId,
      userId,
      seatCost,
      maxMembers: group.maxMembers,
      note:       `團主手動加入群組，代管 ${seatCost} PM`,
    }))

    res.status(201).json(member)
  } catch (err) { next(err) }
});

router.patch('/:id', requireAuth, validate(patchMemberSchema), async (req, res, next) => {
  try {
    const existing = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: {
        group: { select: { hostId: true, planName: true, sharedCredentials: true, service: { select: { name: true } } } },
        user:  { select: { name: true } },
      },
    })
    if (!existing) return res.status(404).json({ message: '成員不存在' })

    const isOwner = existing.userId === req.user.id
    const isHost  = existing.group.hostId === req.user.id
    if (!isOwner && !isHost) return res.status(403).json({ message: '無操作權限' })

    const member = await prisma.member.update({
      where: { id: req.params.id },
      data:  req.body.serviceInfo !== undefined
        ? { ...req.body, extractionStartedAt: null, extractionNotificationId: null, extractionCommentId: null }
        : req.body,
    })

    const groupLabel = existing.group.planName ?? existing.group.service?.name ?? ''

    let groupAdvancedStatus = null;
    if (req.body.serviceInfo !== undefined) {
      const isSharedCredentials = !!existing.group.sharedCredentials;
      const memberName = existing.user?.name ?? '成員'

      if (isSharedCredentials) {
        prisma.credentialComment.create({
          data: {
            groupId:  existing.groupId,
            authorId: existing.userId,
            content:  existing.serviceInfoIssueNote ? '已處理帳號問題，重新送出帳號資訊' : '已成功提取帳號資訊',
          },
        }).catch(console.error)
      }

      const allMembers = await prisma.member.findMany({ where: { groupId: existing.groupId } })
      const allFilled  = allMembers.every(m => m.serviceInfo != null);

      if (!allFilled) {
        notify({
          userId:  existing.group.hostId,
          type:    'service_info_filled',
          title:   isSharedCredentials ? `${groupLabel} ${memberName}已提取帳號資訊` : `${groupLabel} ${memberName}已填寫服務帳號`,
          message: isSharedCredentials
            ? `${memberName} 已確認取得「${groupLabel}」群組的帳號資訊。`
            : `${memberName} 已填寫「${groupLabel}」群組的服務帳號資訊。`,
          meta:    { groupId: existing.groupId },
        })
      }

      if (allFilled) {
        try {
          const activateDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000)
          await prisma.$transaction(tx => claimGroupStatus(tx, existing.groupId, {
            fromStatus: 'pending_confirmation',
            data:       { status: 'pending_activation', activateDeadline },
          }))
          groupAdvancedStatus = 'pending_activation'

          notify({
            userId:  existing.group.hostId,
            type:    'all_service_info_filled',
            title:   isSharedCredentials ? `${groupLabel} 成員已全部完成提取` : `${groupLabel} 成員已全部完成填寫`,
            message: `「${groupLabel}」群組所有成員都已${isSharedCredentials ? '提取帳號資訊' : '填寫服務帳號'}，可以前往啟用服務了。`,
            meta:    { groupId: existing.groupId },
          });
        } catch (err) {
          if (err.statusCode !== 409)
            throw err;
        }
      }
    }

    if (isHost && req.body.serviceInfoIssueNote) {
      notify({
        userId:  existing.userId,
        type:    'service_info_issue',
        title:   `${groupLabel} 服務帳號需要修正`,
        message: `團主在「${groupLabel}」發現服務帳號問題，請前往修正。`,
        meta:    { groupId: existing.groupId },
      })

      if (existing.group.sharedCredentials) {
        prisma.credentialComment.create({
          data: {
            groupId:  existing.groupId,
            authorId: req.user.id,
            content:  `${existing.user?.name ?? '成員'}的帳號問題已回報，處理中`,
          },
        }).catch(console.error)
      }
    }

    const resolvedMember = await resolveMemberEvidenceUrls(member);
    res.json(groupAdvancedStatus ? { ...resolvedMember, _groupAdvanced: groupAdvancedStatus } : resolvedMember)
  } catch (err) { next(err) }
});

router.post('/:id/extraction-start', requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.member.findUnique({
      where: { id: req.params.id },
      include: {
        group: { select: { hostId: true, planName: true, sharedCredentials: true, service: { select: { name: true } } } },
        user:  { select: { name: true } },
      },
    })
    if (!existing) return res.status(404).json({ message: '成員不存在' })
    if (existing.userId !== req.user.id) return res.status(403).json({ message: '無操作權限' })
    if (!existing.group.sharedCredentials) return res.status(400).json({ message: '此群組非共用帳密方式' })

    const groupLabel = existing.group.planName ?? existing.group.service?.name ?? ''
    const title      = `${groupLabel} ${existing.user?.name ?? '成員'}正在提取帳號資訊`
    const message    = `${existing.user?.name ?? '成員'} 正在查看「${groupLabel}」的帳號資訊。`

    let notificationId = existing.extractionNotificationId
    if (notificationId) {
      const updated = await prisma.notification.updateMany({
        where: { id: notificationId },
        data:  { createdAt: new Date(), isRead: false, message },
      })
      if (updated.count === 0)
        notificationId = null;
    }
    if (!notificationId) {
      const created = await notify({
        userId:  existing.group.hostId,
        type:    'credential_extraction_started',
        title,
        message,
        meta:    { groupId: existing.groupId },
      })
      notificationId = created?.id ?? null
    }

    let commentId = existing.extractionCommentId
    if (commentId) {
      const updated = await prisma.credentialComment.updateMany({
        where: { id: commentId },
        data:  { createdAt: new Date() },
      })
      if (updated.count === 0) commentId = null
    }
    if (!commentId) {
      const created = await prisma.credentialComment.create({
        data: { groupId: existing.groupId, authorId: existing.userId, content: '已查看帳號資訊' },
      }).catch(err => { console.error(err); return null })
      commentId = created?.id ?? null
    }

    await prisma.member.update({
      where: { id: req.params.id },
      data:  { extractionStartedAt: new Date(), extractionNotificationId: notificationId, extractionCommentId: commentId },
    })

    res.status(204).end()
  } catch (err) { next(err) }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await removeMember({ memberId: req.params.id, actorId: req.user.id })
    res.status(200).json(result)
  } catch (err) { next(err) }
});

export default router
