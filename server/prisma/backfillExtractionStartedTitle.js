import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const notifications = await prisma.notification.findMany({
    where: {
      type:  'credential_extraction_started',
      title: { endsWith: '正在提取帳號資訊' },
    },
    select: { id: true, title: true },
  })

  let updated = 0
  for (const n of notifications) {
    const groupLabelMatch = n.title.match(/^(.*) .+正在提取帳號資訊$/)
    const groupLabel = groupLabelMatch ? groupLabelMatch[1] : null
    if (!groupLabel) continue
    const newTitle = `${groupLabel} 有成員正在提取帳號資訊`
    if (newTitle === n.title) continue
    await prisma.notification.update({ where: { id: n.id }, data: { title: newTitle } })
    updated += 1
  }
  console.log(`notifications：共 ${notifications.length} 筆符合舊標題格式，更新 ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
