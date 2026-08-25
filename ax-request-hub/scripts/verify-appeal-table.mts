import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const count = await p.projectAppeal.count()
  console.log('ProjectAppeal count:', count, '— 테이블 정상')
}

main().catch((e) => console.error('ERROR:', e.message)).finally(() => p.$disconnect())
