import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const notifications = await prisma.notification.findMany({
    where: { type: 'dispute_raised' },
    select: { id: true, meta: true, createdAt: true },
  })

  let updated = 0
  for (const n of notifications) {
    if (n.meta?.memberId) continue
    const groupId = n.meta?.groupId
    if (!groupId) continue

    const disputes = await prisma.dispute.findMany({
      where: { groupId },
      select: { memberId: true, raisedAt: true },
    })
    if (disputes.length === 0) continue

    const closest = disputes.reduce((best, d) => {
      const diff = Math.abs(new Date(d.raisedAt).getTime() - new Date(n.createdAt).getTime())
      return diff < best.diff ? { memberId: d.memberId, diff } : best
    }, { memberId: null, diff: Infinity })

    if (!closest.memberId) continue

    await prisma.notification.update({
      where: { id: n.id },
      data:  { meta: { ...(n.meta ?? {}), memberId: closest.memberId } },
    })
    updated += 1
  }
  console.log(`notifications：共 ${notifications.length} 筆 dispute_raised 通知，補上 memberId ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
