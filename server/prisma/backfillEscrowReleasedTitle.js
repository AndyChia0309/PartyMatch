import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const notifications = await prisma.notification.findMany({
    where: {
      type:  'escrow_released',
      title: { endsWith: '代管款項已撥款' },
    },
    select: { id: true, title: true },
  })

  let updated = 0
  for (const n of notifications) {
    const newTitle = n.title.replace(/代管款項已撥款$/, '已確認，代管金額將存入您的PM幣帳戶，請前往查收')
    await prisma.notification.update({ where: { id: n.id }, data: { title: newTitle } })
    updated += 1
  }
  console.log(`notifications：共 ${notifications.length} 筆符合舊標題格式，更新 ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
