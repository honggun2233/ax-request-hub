import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyServiceToken } from '@/lib/service-auth'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const rawToken = auth?.replace('Bearer ', '') ?? ''

  const serviceToken = await verifyServiceToken(rawToken)
  if (!serviceToken) {
    return NextResponse.json({ error: 'Invalid or expired service token' }, { status: 401 })
  }
  if (!serviceToken.scopes.split(',').includes('usage:write')) {
    return NextResponse.json({ error: 'Insufficient scope' }, { status: 403 })
  }

  let body: {
    agentKey: string
    providerKey: string
    inputTokens?: number
    outputTokens?: number
    tokenUsed?: number
    costKrw?: number
    ownerEmail?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { agentKey, providerKey, inputTokens = 0, outputTokens = 0, tokenUsed, costKrw = 0, ownerEmail } = body
  if (!agentKey || !providerKey) {
    return NextResponse.json({ error: 'agentKey and providerKey are required' }, { status: 400 })
  }

  // agentKey로 AgentRegistry 조회
  const registry = await prisma.agentRegistry.findFirst({
    where: { agentKey },
    select: { id: true },
  })
  if (!registry) {
    return NextResponse.json({ error: `AgentRegistry not found for agentKey: ${agentKey}` }, { status: 404 })
  }

  const totalTokens = tokenUsed ?? inputTokens + outputTokens

  const record = await prisma.agentRuntimeUsage.create({
    data: {
      agentId: registry.id,
      ownerEmail: ownerEmail ?? serviceToken.createdBy,
      providerKey,
      tokenUsed: totalTokens,
      costKrw,
    },
  })

  // AgentRegistry.lastUsedAt 갱신
  await prisma.agentRegistry.update({
    where: { id: registry.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return NextResponse.json(record, { status: 201 })
}
