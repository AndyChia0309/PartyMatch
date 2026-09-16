import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const notifications = await prisma.notification.findMany({
    where: { type: 'dispute_escalated' },
    select: { id: true, userId: true, title: true, message: true, meta: true },
  })

  let updatedCount = 0
  let createdCount = 0

  for (const n of notifications) {
    const groupId = n.meta?.groupId
    if (!groupId) continue

    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { hostId: true } })
    if (!group) continue

    const groupLabelMatch = n.title.match(/^(.*) 問題回報進入仲裁$/)
    const groupLabel = groupLabelMatch ? groupLabelMatch[1] : ''
    const newTitle = groupLabel ? `${groupLabel} 問題回報已由平台接管` : n.title
    const newMessage = groupLabel
      ? `「${groupLabel}」的問題回報已由平台客服接管處理，請耐心等候。`
      : n.message

    if (n.title !== newTitle || n.message !== newMessage) {
      await prisma.notification.update({ where: { id: n.id }, data: { title: newTitle, message: newMessage } })
      updatedCount += 1
    }

    if (group.hostId !== n.userId) {
      const existingHostNotif = await prisma.notification.findFirst({
        where: {
          type:   'dispute_escalated',
          userId: group.hostId,
          meta:   { path: '$.groupId', equals: groupId },
        },
      })
      if (!existingHostNotif) {
        await prisma.notification.create({
          data: {
            userId:  group.hostId,
            type:    'dispute_escalated',
            title:   newTitle,
            message: newMessage,
            meta:    n.meta,
          },
        })
        createdCount += 1
      }
    }
  }

  console.log(`dispute_escalated 通知：共 ${notifications.length} 筆，更新文案 ${updatedCount} 筆，補發給團主 ${createdCount} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
