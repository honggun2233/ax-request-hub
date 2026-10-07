import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { notify } from '@/lib/notify'

// POST /api/registry/[id]/ultra-high-block
// AX팀이 초고위험 판정 에이전트를 즉시 운영 중지 (운영규정 제11조⑤, 제15조③)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const { id } = await params
  const { reason } = await req.json() as { reason: string }
  if (!reason?.trim()) {
    return NextResponse.json({ error: '중단 사유를 입력해야 합니다.' }, { status: 400 })
  }

  const agent = await prisma.agentRegistry.findUnique({
    where: { id },
    select: { id: true, agentName: true, lifecycleStage: true, projectId: true },
  })
  if (!agent) return NextResponse.json({ error: '에이전트를 찾을 수 없습니다.' }, { status: 404 })

  if (agent.lifecycleStage === 'ULTRA_HIGH_BLOCKED') {
    return NextResponse.json({ message: '이미 초고위험 차단 상태입니다.' })
  }

  const now = new Date()

  // 에이전트 즉시 운영 중지
  await prisma.agentRegistry.update({
    where: { id },
    data: {
      lifecycleStage: 'ULTRA_HIGH_BLOCKED',
      isUltraHighRisk: true,
      retireReason: `초고위험 판정: ${reason}`,
    } as any,
  })

  // AI위원회 안건 자동 생성
  await prisma.councilAgendaItem.create({
    data: {
      agentId: id,
      projectId: agent.projectId ?? null,
      itemType: 'HIGH_RISK_REJECTION',
      packageMeta: JSON.stringify({
        reason: `초고위험 판정 — 즉시 운영 중지`,
        detail: reason,
        blockedBy: (auth as any).user?.email,
        blockedAt: now.toISOString(),
        agentName: agent.agentName,
        previousStage: agent.lifecycleStage,
      }),
    },
  })

  // AuditLog 기록
  await prisma.auditLog.create({
    data: {
      entityType: 'AgentRegistry',
      entityId: id,
      action: 'ULTRA_HIGH_RISK_BLOCK',
      actorEmail: (auth as any).user?.email ?? 'unknown',
      detail: JSON.stringify({ reason, previousStage: agent.lifecycleStage }),
    },
  })

  // 소속 부서장 + AX팀 전체 알림 (운영규정 제16조①)
  const axTeamMembers = await prisma.employee.findMany({
    where: { role: 'AX_TEAM', isActive: true },
    select: { email: true },
  })
  for (const member of axTeamMembers) {
    await notify(prisma, member.email,
      `[초고위험 차단] ${agent.agentName}`,
      `초고위험 판정으로 즉시 운영 중지되었습니다. AI위원회 검토가 필요합니다. 사유: ${reason}`,
      `/registry?agentId=${id}`
    )
  }

  return NextResponse.json({
    ok: true,
    lifecycleStage: 'ULTRA_HIGH_BLOCKED',
    message: `${agent.agentName} 에이전트가 초고위험 판정으로 즉시 운영 중지되었습니다. AI위원회 안건이 생성되었습니다.`,
  })
}

// DELETE /api/registry/[id]/ultra-high-block — AI위원회 의결 후 차단 해제 (C_LEVEL만)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole('C_LEVEL')
  if ('error' in auth) return auth.error

  const { id } = await params
  const { councilDecision, restoreStage } = await req.json() as { councilDecision: string; restoreStage: string }

  const allowed = ['GATE1', 'GATE2', 'GATE3', 'ACTIVE', 'DEGRADED']
  if (!allowed.includes(restoreStage)) {
    return NextResponse.json({ error: `복구 단계는 ${allowed.join('|')} 중 하나여야 합니다.` }, { status: 400 })
  }

  await prisma.agentRegistry.update({
    where: { id },
    data: { lifecycleStage: restoreStage, isUltraHighRisk: false } as any,
  })

  await prisma.auditLog.create({
    data: {
      entityType: 'AgentRegistry',
      entityId: id,
      action: 'ULTRA_HIGH_RISK_UNBLOCK',
      actorEmail: (auth as any).user?.email ?? 'unknown',
      detail: JSON.stringify({ councilDecision, restoreStage }),
    },
  })

  return NextResponse.json({ ok: true, lifecycleStage: restoreStage, message: '초고위험 차단이 해제되었습니다.' })
}
