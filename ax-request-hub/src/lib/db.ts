import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaVer?: number
}

const SCHEMA_VER = 6 // prisma generate로 inlineSchema 재생성 후 강제 재초기화
if (globalForPrisma.prismaVer !== SCHEMA_VER) {
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaVer = SCHEMA_VER
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
