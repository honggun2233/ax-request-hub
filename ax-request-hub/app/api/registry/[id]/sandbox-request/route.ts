import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { notify } from '@/lib/notify'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/registry/[id]/sandbox-request
 * 현업이 샌드박스 PoC 사용 요청 제출
 * 전제조건: lifecycleStage === 'GATE2'
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireRole()
  if ('error' in auth) return auth.error

  const { id } = await params
  const { sandboxEnv, requestReason } = await req.json()

  if (!requestReason) {
    return NextResponse.json({ error: 'requestReason은 필수입니다.' }, { status: 400 })
  }

  const agent = await prisma.agentRegistry.findUnique({
    where: { id },
    select: { id: true, agentName: true, lifecycleStage: true, sandboxRequestedAt: true },
  })
  if (!agent) return NextResponse.json({ error: '에이전트를 찾을 수 없습니다.' }, { status: 404 })

  if (agent.lifecycleStage !== 'GATE2') {
    return NextResponse.json(
      { error: `GATE2 단계에서만 샌드박스 PoC를 요청할 수 있습니다. (현재: ${agent.lifecycleStage})` },
      { status: 422 }
    )
  }

  const updated = await prisma.agentRegistry.update({
    where: { id },
    data: {
      sandboxRequestedAt: new Date(),
      sandboxRequestReason: requestReason,
      sandboxEnv: sandboxEnv ?? null,
      sandboxRejectReason: null,
    },
  })

  // AX팀 전체 알림
  const axTeamMembers = await prisma.employee.findMany({
    where: { role: 'AX_TEAM', isActive: true },
    select: { email: true },
  })
  for (const member of axTeamMembers) {
    await notify(
      member.email,
      `[샌드박스 PoC 요청] ${agent.agentName}`,
      `${agent.agentName} 에이전트의 샌드박스 PoC 사용 요청이 접수됐습니다. AX팀 심사가 필요합니다.`,
      `/registry?highlight=${id}`
    ).catch(() => {})
  }

  return NextResponse.json({ message: '샌드박스 PoC 요청이 접수됐습니다. AX팀 심사 후 승인됩니다.', agent: updated }, { status: 201 })
}

/**
 * PATCH /api/registry/[id]/sandbox-request
 * AX팀이 샌드박스 신청 승인 또는 반려
 * 승인: lifecycleStage → SANDBOX_POC
 * 반려: lifecycleStage 유지(GATE2), rejectReason 기록
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const { id } = await params
  const { decision, rejectReason } = await req.json()

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return NextResponse.json({ error: 'decision은 APPROVED 또는 REJECTED여야 합니다.' }, { status: 400 })
  }

  const agent = await prisma.agentRegistry.findUnique({
    where: { id },
    select: { id: true, agentName: true, lifecycleStage: true, sandboxRequestedAt: true },
  })
  if (!agent) return NextResponse.json({ error: '에이전트를 찾을 수 없습니다.' }, { status: 404 })
  if (!agent.sandboxRequestedAt) {
    return NextResponse.json({ error: '샌드박스 요청이 없습니다.' }, { status: 422 })
  }
  if (agent.lifecycleStage !== 'GATE2') {
    return NextResponse.json(
      { error: `GATE2 단계의 에이전트만 샌드박스 심사를 처리할 수 있습니다. (현재: ${agent.lifecycleStage})` },
      { status: 422 }
    )
  }

  const now = new Date()
  const updateData: any =
    decision === 'APPROVED'
      ? {
          lifecycleStage: 'SANDBOX_POC',
          sandboxApprovedBy: auth.user.email,
          sandboxApprovedAt: now,
          sandboxRejectReason: null,
          updatedAt: now,
        }
      : {
          sandboxRejectReason: rejectReason ?? '반려 사유 없음',
          sandboxApprovedBy: null,
          sandboxApprovedAt: null,
          updatedAt: now,
        }

  const updated = await prisma.agentRegistry.update({ where: { id }, data: updateData })

  await prisma.auditLog.create({
    data: {
      entityType: 'AgentRegistry',
      entityId: id,
      action: decision === 'APPROVED' ? 'SANDBOX_POC_APPROVED' : 'SANDBOX_POC_REJECTED',
      actorEmail: auth.user.email,
      detail: JSON.stringify({ decision, rejectReason: rejectReason ?? null }),
    },
  })

  return NextResponse.json({ message: decision === 'APPROVED' ? '샌드박스 PoC가 승인됐습니다.' : '샌드박스 요청이 반려됐습니다.', agent: updated })
}
