import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { buildGate3UpdateData } from '@/src/lib/gate-transitions'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/registry/[id]/sandbox-complete
 * PoC 완료 선언 + 결과 요약 제출
 * 완료 후 lifecycleStage → GATE3 전환 (gate3Passed/At은 공유 함수로 처리)
 * 전제조건: lifecycleStage === 'SANDBOX_POC'
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole()
  if ('error' in auth) return auth.error

  const { id } = await params
  const { pocResultSummary } = await req.json()

  if (!pocResultSummary) {
    return NextResponse.json({ error: 'pocResultSummary(PoC 결과 요약)는 필수입니다.' }, { status: 400 })
  }

  const agent = await prisma.agentRegistry.findUnique({
    where: { id },
    select: { id: true, agentName: true, lifecycleStage: true },
  })
  if (!agent) return NextResponse.json({ error: '에이전트를 찾을 수 없습니다.' }, { status: 404 })
  if (agent.lifecycleStage !== 'SANDBOX_POC') {
    return NextResponse.json(
      { error: `SANDBOX_POC 단계에서만 PoC 완료 처리가 가능합니다. (현재: ${agent.lifecycleStage})` },
      { status: 422 }
    )
  }

  const now = new Date()
  const updated = await prisma.agentRegistry.update({
    where: { id },
    data: {
      sandboxCompletedAt: now,
      pocResultSummary,
      lifecycleStage: 'GATE3',
      ...buildGate3UpdateData(now),
      updatedAt: now,
    },
  })

  await prisma.auditLog.create({
    data: {
      entityType: 'AgentRegistry',
      entityId: id,
      action: 'SANDBOX_POC_COMPLETED',
      actorEmail: auth.user.email,
      detail: JSON.stringify({ pocResultSummary }),
    },
  })

  return NextResponse.json({
    message: 'PoC 완료. GATE3로 전환됐습니다.',
    agent: updated,
  })
}
