import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

const MATCH_WINDOW_MS = 5000

async function main() {
  const lockedNotifs = await prisma.notification.findMany({
    where: { type: 'group_chat_opened' },
    select: { id: true, userId: true, meta: true, createdAt: true },
  })
  const fillNotifs = await prisma.notification.findMany({
    where: { type: 'fill_service_info' },
    select: { id: true, userId: true, meta: true, createdAt: true },
  })

  let updated = 0
  for (const locked of lockedNotifs) {
    const groupId = locked.meta?.groupId
    if (!groupId) continue

    let closest = null
    let closestDiff = Infinity
    for (const fill of fillNotifs) {
      if (fill.userId !== locked.userId || fill.meta?.groupId !== groupId) continue
      const diff = Math.abs(new Date(fill.createdAt).getTime() - new Date(locked.createdAt).getTime())
      if (diff < closestDiff) {
        closestDiff = diff
        closest = fill
      }
    }
    if (!closest || closestDiff > MATCH_WINDOW_MS) continue

    const fillTime   = new Date(closest.createdAt).getTime()
    const lockedTime = new Date(locked.createdAt).getTime()
    if (fillTime > lockedTime) continue // already correctly newer than locked

    const newFillTime = new Date(lockedTime + 2)
    await prisma.notification.update({ where: { id: closest.id }, data: { createdAt: newFillTime } })
    updated += 1
  }

  console.log(`fill_service_info：共 ${fillNotifs.length} 筆，找到配對且順序錯誤已修正 ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
