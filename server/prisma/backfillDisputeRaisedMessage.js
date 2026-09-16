import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const notifications = await prisma.notification.findMany({
    where: {
      type:    'dispute_raised',
      message: { contains: '將於 48 小時內處理完成' },
    },
    select: { id: true, message: true },
  })

  let updated = 0
  for (const n of notifications) {
    const newMessage = n.message.replace('將於 48 小時內處理完成', '請於 48 小時內處理完成')
    await prisma.notification.update({ where: { id: n.id }, data: { message: newMessage } })
    updated += 1
  }
  console.log(`notifications：共 ${notifications.length} 筆符合舊文案，更新 ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
