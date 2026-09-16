import 'dotenv/config';
import prisma from '../src/lib/prisma.js'

async function main() {
  const messages = await prisma.message.findMany({
    where: {
      type:    'system',
      content: { endsWith: '回報了服務問題，等待處理。' },
    },
    select: { id: true, content: true },
  })

  if (messages.length > 0) {
    await prisma.message.deleteMany({ where: { id: { in: messages.map(m => m.id) } } })
  }
  console.log(`messages：共 ${messages.length} 筆舊的「回報了服務問題，等待處理」系統訊息，已刪除`)
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
