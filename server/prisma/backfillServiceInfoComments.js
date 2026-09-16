import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const members = await prisma.member.findMany({
    where: {
      serviceInfo: { not: null },
      group: { sharedCredentials: null },
    },
    select: { id: true, groupId: true, userId: true, serviceInfoIssueNote: true, updatedAt: true },
  })

  let created = 0
  for (const m of members) {
    const existing = await prisma.credentialComment.findFirst({
      where: { groupId: m.groupId, authorId: m.userId, content: { in: ['已填寫服務帳號', '已處理帳號問題，重新填寫服務帳號'] } },
    })
    if (existing) continue

    await prisma.credentialComment.create({
      data: {
        groupId:   m.groupId,
        authorId:  m.userId,
        content:   m.serviceInfoIssueNote ? '已處理帳號問題，重新填寫服務帳號' : '已填寫服務帳號',
        createdAt: m.updatedAt,
      },
    })
    created += 1
  }
  console.log(`members：共 ${members.length} 筆已填寫帳號資訊（非共用帳密），補上 ${created} 筆留言`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
