import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const members = await prisma.member.findMany({
    where: { serviceInfoIssueNote: { not: null }, disputeRaisedCycle: null },
    select: { id: true, groupId: true },
  })

  let updated = 0
  for (const m of members) {
    const group = await prisma.group.findUnique({ where: { id: m.groupId }, select: { currentCycle: true } })
    if (!group) continue
    await prisma.member.update({ where: { id: m.id }, data: { disputeRaisedCycle: group.currentCycle } })
    updated += 1
  }
  console.log(`members：共 ${members.length} 筆進行中的問題回報缺 disputeRaisedCycle，補上 ${updated} 筆`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
