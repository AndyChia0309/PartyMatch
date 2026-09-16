import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const notifications = await prisma.notification.findMany({
    where: {
      type:  'new_application',
      title: { endsWith: '提出申請' },
    },
    select: { id: true, title: true },
  })

  let updated = 0
  for (const n of notifications) {
    const groupLabelMatch = n.title.match(/^(.*) .+提出申請$/)
    const groupLabel = groupLabelMatch ? groupLabelMatch[1] : null
    if (!groupLabel) continue
    await prisma.notification.update({ where: { id: n.id }, data: { title: `${groupLabel} 已收到新的申請` } })
    updated += 1
  }
  console.log(`notifications：共 ${notifications.length} 筆符合舊標題格式，更新 ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
