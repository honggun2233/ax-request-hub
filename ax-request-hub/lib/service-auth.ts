import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export async function verifyServiceToken(rawToken: string) {
  const hash = createHash('sha256').update(rawToken).digest('hex')
  const token = await prisma.serviceToken.findUnique({ where: { tokenHash: hash } })
  if (!token || !token.isActive) return null
  if (token.expiresAt && token.expiresAt < new Date()) return null
  // lastUsedAt 비동기 업데이트 (fire-and-forget)
  prisma.serviceToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})
  return token
}
