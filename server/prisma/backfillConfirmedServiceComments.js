import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const members = await prisma.member.findMany({
    where: {
      confirmedAt: { not: null },
      group: { sharedCredentials: null },
    },
    select: { id: true, groupId: true, userId: true, confirmedAt: true },
  })

  let created = 0
  for (const m of members) {
    const existing = await prisma.credentialComment.findFirst({
      where: { groupId: m.groupId, authorId: m.userId, content: '已確認服務' },
    })
    if (existing) continue

    await prisma.credentialComment.create({
      data: {
        groupId:   m.groupId,
        authorId:  m.userId,
        content:   '已確認服務',
        createdAt: m.confirmedAt,
      },
    })
    created += 1
  }
  console.log(`members：共 ${members.length} 筆已確認服務（非共用帳密），補上 ${created} 筆留言`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
