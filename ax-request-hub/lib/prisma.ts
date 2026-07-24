import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; prismaVer?: number }

const SCHEMA_VER = 6 // prisma generate로 inlineSchema 재생성 후 강제 재초기화
if (globalForPrisma.prismaVer !== SCHEMA_VER) {
  globalForPrisma.prisma = undefined as any
  globalForPrisma.prismaVer = SCHEMA_VER
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
