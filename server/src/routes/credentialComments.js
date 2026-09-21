import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { maskAvatar } from '../lib/avatarVisibility.js'
import { getSignedDownloadUrl } from '../lib/r2Storage.js'
import { notifyBatch } from './groups/shared.js'

const router = Router()

const createCommentSchema = z.object({
  groupId: z.string().min(1),
  content: z.string().trim().max(500).default(''),
  attachmentUrl: z.string().min(1).optional(),
}).refine(data => data.content.length > 0 || !!data.attachmentUrl, {
  message: '留言內容或附件至少需要一項',
})

async function assertGroupAccess(groupId, userId) {
  const [isMember, isHost] = await Promise.all([
    prisma.member.findFirst({ where: { groupId, userId } }),
    prisma.group.findFirst({ where: { id: groupId, hostId: userId } }),
  ])
  return !!isMember || !!isHost
}

router.get('/:groupId', requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params
    if (!(await assertGroupAccess(groupId, req.user.id))) {
      return res.status(403).json({ message: '無權限查看此群組的留言' })
    }
    const comments = await prisma.credentialComment.findMany({
      where:   { groupId },
      include: { author: { select: { id: true, name: true, avatarColor: true, avatarInitial: true, showAvatar: true, presenceStatus: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const visibleComments = comments.filter(c => !c.visibleToUserIds || c.visibleToUserIds.includes(req.user.id))
    const resolved = await Promise.all(visibleComments.map(async c => ({
      ...c,
      author: maskAvatar(c.author),
      ...(c.attachmentUrl && { attachmentUrl: await getSignedDownloadUrl(c.attachmentUrl) }),
    })));
    res.json(resolved)
  } catch (err) { next(err) }
});

router.post('/', requireAuth, validate(createCommentSchema), async (req, res, next) => {
  try {
    const { groupId, content, attachmentUrl } = req.body
    if (!(await assertGroupAccess(groupId, req.user.id))) {
      return res.status(403).json({ message: '無權限在此群組留言' })
    }
    const comment = await prisma.credentialComment.create({
      data:    { groupId, authorId: req.user.id, content, ...(attachmentUrl && { attachmentUrl }) },
      include: { author: { select: { id: true, name: true, avatarColor: true, avatarInitial: true, showAvatar: true, presenceStatus: true } } },
    })

    const group = await prisma.group.findUnique({
      where:  { id: groupId },
      select: { hostId: true, planName: true, service: { select: { name: true } } },
    })
    if (group) {
      const groupLabel = group.planName ?? group.service?.name ?? ''
      const authorName = comment.author?.name ?? '成員'
      const title       = `${groupLabel} 帳號資訊有新留言`
      const message     = `${authorName}已新增留言，請點擊後前往查看。`
      const members = await prisma.member.findMany({ where: { groupId }, select: { userId: true } })
      const recipientIds = [group.hostId, ...members.map(m => m.userId)].filter(id => id !== req.user.id)
      if (recipientIds.length > 0) {
        notifyBatch(recipientIds.map(userId => ({
          userId,
          type:    'credential_comment',
          title,
          message,
          meta:    { groupId },
        })))
      }
    }

    res.status(201).json({
      ...comment,
      author: maskAvatar(comment.author),
      ...(comment.attachmentUrl && { attachmentUrl: await getSignedDownloadUrl(comment.attachmentUrl) }),
    })
  } catch (err) { next(err) }
});

export default router
