import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const notifications = await prisma.notification.findMany({
    where: {
      type:    'group_chat_opened',
      message: { contains: '聊天室已建立，點擊查看。' },
    },
    select: { id: true, message: true },
  })

  let updated = 0
  for (const n of notifications) {
    const newMessage = n.message.replace('聊天室已建立，點擊查看。', '聊天室已建立。')
    await prisma.notification.update({ where: { id: n.id }, data: { message: newMessage } })
    updated += 1
  }
  console.log(`notifications：共 ${notifications.length} 筆符合舊文案，更新 ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
