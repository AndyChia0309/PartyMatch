import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

const MATCH_WINDOW_MS = 5000

async function main() {
  const fullNotifs = await prisma.notification.findMany({
    where: { type: 'group_full_member' },
    select: { id: true, userId: true, meta: true, createdAt: true },
  })
  const approvedNotifs = await prisma.notification.findMany({
    where: { type: 'application_approved' },
    select: { id: true, userId: true, meta: true, createdAt: true },
  })

  let updated = 0
  for (const full of fullNotifs) {
    const groupId = full.meta?.groupId
    if (!groupId) continue

    let closest = null
    let closestDiff = Infinity
    for (const approved of approvedNotifs) {
      if (approved.userId !== full.userId || approved.meta?.groupId !== groupId) continue
      const diff = Math.abs(new Date(approved.createdAt).getTime() - new Date(full.createdAt).getTime())
      if (diff < closestDiff) {
        closestDiff = diff
        closest = approved
      }
    }
    if (!closest || closestDiff > MATCH_WINDOW_MS) continue

    const approvedTime = new Date(closest.createdAt).getTime()
    const fullTime = new Date(full.createdAt).getTime()
    if (fullTime > approvedTime) continue // already correctly newer

    const newFullTime = new Date(approvedTime + 2)
    await prisma.notification.update({ where: { id: full.id }, data: { createdAt: newFullTime } })
    updated += 1
  }

  console.log(`group_full_member：共 ${fullNotifs.length} 筆，找到配對且順序錯誤已修正 ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
