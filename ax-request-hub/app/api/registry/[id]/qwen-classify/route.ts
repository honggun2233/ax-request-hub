import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { classifyTask } from '@/src/lib/ai-gateway/routing'

// GET /api/registry/[id]/qwen-classify
// Qwen으로 에이전트 용도 분류 → recommendedProvider 저장 + 결과 반환
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const agent = await prisma.agentRegistry.findUnique({
    where: { id: params.id },
    select: { id: true, agentName: true, purpose: true, recommendedProvider: true, providerOverride: true },
  })
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const taskSummary = `에이전트 이름: ${agent.agentName}\n용도: ${agent.purpose}`
  const result = await classifyTask(taskSummary)

  // 분류 성공 시 recommendedProvider 저장 (override는 건드리지 않음)
  if (result.confidence > 0) {
    await prisma.agentRegistry.update({
      where: { id: params.id },
      data: { recommendedProvider: result.vendor },
    }).catch(() => {})
  }

  return NextResponse.json({
    vendor: result.vendor,
    confidence: result.confidence,
    reason: result.reason,
    providerOverride: agent.providerOverride,
  })
}

// PATCH /api/registry/[id]/qwen-classify — AX_TEAM이 수동 override 저장
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const { providerOverride } = await req.json() as { providerOverride: string | null }
  const allowed = ['claude', 'gpt', 'gemini', null]
  if (!allowed.includes(providerOverride)) {
    return NextResponse.json({ error: 'Invalid providerOverride' }, { status: 400 })
  }

  const agent = await prisma.agentRegistry.update({
    where: { id: params.id },
    data: { providerOverride: providerOverride ?? null },
    select: { id: true, recommendedProvider: true, providerOverride: true },
  })

  return NextResponse.json(agent)
}
