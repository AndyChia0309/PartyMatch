import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const notifications = await prisma.notification.findMany({
    where: {
      type:  'group_activated',
      title: { endsWith: '已啟用' },
      NOT:   { title: { endsWith: '服務已啟用' } },
    },
    select: { id: true, title: true },
  })

  let updated = 0
  for (const n of notifications) {
    const newTitle = `${n.title.slice(0, -3)}服務已啟用`
    await prisma.notification.update({ where: { id: n.id }, data: { title: newTitle } })
    updated += 1
  }
  console.log(`notifications：共 ${notifications.length} 筆符合舊標題格式，更新 ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
