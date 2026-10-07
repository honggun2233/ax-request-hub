import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { classifyTask } from '@ssam/ai-gateway'

// GET /api/registry/[id]/qwen-classify
// Qwen으로 에이전트 용도 분류 → recommendedProvider 저장 + 결과 반환
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error
  const { id } = await params

  const agent = await prisma.agentRegistry.findUnique({
    where: { id },
    select: { id: true, agentName: true, purpose: true, recommendedProvider: true, providerOverride: true, projectId: true },
  })
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const taskSummary = `에이전트 이름: ${agent.agentName}\n용도: ${agent.purpose}`
  const result = await classifyTask(taskSummary)

  // 분류 성공 시 recommendedProvider 저장 + 고영향 AI 판별 결과 동기화 (운영규정 제10조③)
  if (result.confidence > 0) {
    const isHighImpact = (result as any).isHighImpact ?? false
    const isHighCapability = (result as any).isHighCapability ?? false
    await prisma.agentRegistry.update({
      where: { id },
      data: {
        recommendedProvider: result.vendor,
        ...(isHighImpact && { isHighImpact: true }),
      },
    }).catch(() => {})

    // 연결 과제에 고영향·고성능 플래그 반영 → evaluate 시 고위험 자동 승격 트리거
    if ((isHighImpact || isHighCapability) && agent.projectId) {
      await prisma.project.update({
        where: { id: agent.projectId },
        data: {
          ...(isHighImpact && { isHighImpactAI: true }),
          ...(isHighCapability && { isHighCapabilityAI: true }),
        },
      }).catch(() => {})
    }
  }

  return NextResponse.json({
    vendor: result.vendor,
    confidence: result.confidence,
    reason: result.reason,
    isHighImpact: (result as any).isHighImpact ?? false,
    isHighCapability: (result as any).isHighCapability ?? false,
    providerOverride: agent.providerOverride,
  })
}

// PATCH /api/registry/[id]/qwen-classify — AX_TEAM이 수동 override 저장
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error
  const { id } = await params

  const { providerOverride } = await req.json() as { providerOverride: string | null }
  const allowed = ['claude', 'gpt', 'gemini', null]
  if (!allowed.includes(providerOverride)) {
    return NextResponse.json({ error: 'Invalid providerOverride' }, { status: 400 })
  }

  const agent = await prisma.agentRegistry.update({
    where: { id },
    data: { providerOverride: providerOverride ?? null },
    select: { id: true, recommendedProvider: true, providerOverride: true },
  })

  return NextResponse.json(agent)
}
