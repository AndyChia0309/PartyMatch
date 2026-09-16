import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const notifications = await prisma.notification.findMany({
    where: {
      type: 'service_info_filled',
      OR: [
        { title: { endsWith: '已提取帳號資訊' } },
        { title: { endsWith: '已填寫服務帳號' } },
      ],
    },
    select: { id: true, title: true },
  })

  let updated = 0
  for (const n of notifications) {
    const isExtract = n.title.endsWith('已提取帳號資訊')
    const suffix = isExtract ? '已提取帳號資訊' : '已填寫服務帳號'
    const groupLabelMatch = n.title.match(new RegExp(`^(.*) .+${suffix}$`))
    const groupLabel = groupLabelMatch ? groupLabelMatch[1] : null
    if (!groupLabel) continue
    const newTitle = `${groupLabel} 有成員${suffix}`
    if (newTitle === n.title) continue
    await prisma.notification.update({ where: { id: n.id }, data: { title: newTitle } })
    updated += 1
  }
  console.log(`notifications：共 ${notifications.length} 筆符合舊標題格式，更新 ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
