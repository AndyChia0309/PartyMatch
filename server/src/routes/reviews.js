import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { maskAvatar } from '../lib/avatarVisibility.js'
import { notify } from './groups/shared.js'
import { adjustCreditScore } from '../utils/creditScore.js'

const router = Router()

const createReviewSchema = z.object({
  groupId:    z.string().min(1),
  revieweeId: z.string().min(1),
  rating:     z.number().int().min(1).max(5),
  comment:    z.string().max(500).optional(),
})

function creditDeltaForRating(rating) {
  if (rating === 5) return 5
  if (rating <= 2) return -5
  return 0
}

router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params
    const [aggregate, reviews] = await Promise.all([
      prisma.review.aggregate({ where: { revieweeId: userId }, _avg: { rating: true }, _count: true }),
      prisma.review.findMany({
        where:   { revieweeId: userId },
        include: {
          author: { select: { id: true, name: true, avatarColor: true, avatarInitial: true, showAvatar: true, presenceStatus: true, creditScore: true } },
          group:  { select: { planName: true, service: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])
    res.json({ average: aggregate._avg.rating, count: aggregate._count, reviews: reviews.map(r => ({ ...r, author: maskAvatar(r.author) })) })
  } catch (err) { next(err) }
});

router.post('/', requireAuth, validate(createReviewSchema), async (req, res, next) => {
  try {
    const { groupId, revieweeId, rating, comment } = req.body
    const authorId = req.user.id
    if (authorId === revieweeId) return res.status(400).json({ message: '不能評價自己' })

    const group = await prisma.group.findUnique({
      where:  { id: groupId },
      select: { id: true, hostId: true, planName: true, service: { select: { name: true } } },
    })
    if (!group) return res.status(404).json({ message: '群組不存在' })

    const isAuthorHost   = group.hostId === authorId
    const isRevieweeHost = group.hostId === revieweeId
    if (isAuthorHost === isRevieweeHost) {
      return res.status(400).json({ message: '只能與團主互相評價' })
    }

    if (isAuthorHost) {
      const revieweeMember = await prisma.member.findUnique({ where: { groupId_userId: { groupId, userId: revieweeId } } })
      if (!revieweeMember) return res.status(403).json({ message: '對方不是此群組的成員' })
      if (!revieweeMember.confirmedAt) return res.status(400).json({ message: '對方尚未確認服務，還不能評價' })
    } else {
      const authorMember = await prisma.member.findUnique({ where: { groupId_userId: { groupId, userId: authorId } } })
      if (!authorMember) return res.status(403).json({ message: '僅該群組成員可以留下評價' })
      if (!authorMember.confirmedAt) return res.status(400).json({ message: '請先確認服務後再進行評價' })
    }

    const author = await prisma.user.findUnique({ where: { id: authorId }, select: { name: true } })

    const { review, isNew } = await prisma.$transaction(async (tx) => {
      const [existingRow] = await tx.$queryRawUnsafe(
        'SELECT rating FROM reviews WHERE groupId = ? AND authorId = ? AND revieweeId = ? FOR UPDATE',
        groupId, authorId, revieweeId,
      )
      const prevDelta = existingRow ? creditDeltaForRating(existingRow.rating) : 0
      const newDelta  = creditDeltaForRating(rating)
      const scoreDiff = newDelta - prevDelta

      const saved = await tx.review.upsert({
        where:  { groupId_authorId_revieweeId: { groupId, authorId, revieweeId } },
        update: { rating, comment: comment ?? null },
        create: { groupId, revieweeId, authorId, rating, comment: comment ?? null },
      })
      if (scoreDiff !== 0) {
        await adjustCreditScore(tx, {
          userId: revieweeId,
          delta:  scoreDiff,
          reason: rating === 5 ? '收到 5★ 好評' : `收到 ${rating}★ 差評`,
          groupId,
          relatedReviewId: saved.id,
        })
      }
      return { review: saved, isNew: !existingRow }
    })

    if (isNew) {
      const groupLabel = group.planName ?? group.service?.name ?? ''
      notify({
        userId:  revieweeId,
        type:    'group_reviewed',
        title:   `${groupLabel} ${author?.name ?? '對方'}給了新評價`,
        message: `${author?.name ?? '對方'} 對「${groupLabel}」留下了評價。`,
        meta:    { groupId },
      })
      if (!isAuthorHost) {
        prisma.credentialComment.create({
          data: {
            groupId,
            authorId,
            content: `${author?.name ?? '成員'} 已送出評價。`,
          },
        }).catch(console.error)
      }
    }

    res.status(201).json(review)
  } catch (err) { next(err) }
});

export default router
