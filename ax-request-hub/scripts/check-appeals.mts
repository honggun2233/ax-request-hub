import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  try {
    const count = await p.projectAppeal.count()
    console.log('ProjectAppeal count:', count)
    // 테이블 자체가 없으면 여기서 에러 발생
  } catch (e: unknown) {
    console.error('ERROR:', e instanceof Error ? e.message : String(e))
  } finally {
    await p.$disconnect()
  }
}

main()
