import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

// GET /api/admin/service-tokens — 토큰 목록 (AX_TEAM 전용, rawToken 미노출)
export async function GET() {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const tokens = await prisma.serviceToken.findMany({
    select: {
      id: true,
      description: true,
      agentKey: true,
      scopes: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      createdBy: true,
      // tokenHash 제외
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(tokens)
}

// POST /api/admin/service-tokens — 토큰 발급 (rawToken 1회만 응답)
export async function POST(req: NextRequest) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const body = await req.json()
  const { description, agentKey, scopes, expiresAt } = body as {
    description: string
    agentKey?: string
    scopes?: string
    expiresAt?: string
  }

  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')

  const token = await prisma.serviceToken.create({
    data: {
      tokenHash,
      description,
      agentKey: agentKey ?? null,
      scopes: scopes ?? 'usage:write',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: auth.user.email,
    },
  })

  return NextResponse.json({
    id: token.id,
    description: token.description,
    agentKey: token.agentKey,
    rawToken,  // 이 응답에서만 노출, 이후 조회 불가
    note: '이 토큰은 지금만 확인 가능합니다. 안전하게 보관하세요.',
  }, { status: 201 })
}

// PATCH /api/admin/service-tokens — 토큰 비활성화
export async function PATCH(req: NextRequest) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const { id, isActive } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const token = await prisma.serviceToken.update({
    where: { id },
    data: { isActive: Boolean(isActive) },
    select: { id: true, description: true, isActive: true },
  })

  return NextResponse.json(token)
}
