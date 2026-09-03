import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

/**
 * POST /api/registry/request
 * 에이전트 등록 신청 — 유형 3·4 (AI-GUI-001 제16조)
 * 역할: EMPLOYEE, DEPT_HEAD, AX_TEAM (본인 부서 과제 대상)
 *
 * body: { projectId, agentName, description, riskType (1~4), agentType }
 *
 * 처리 흐름:
 *  1. 과제 존재 + 승인 상태 확인
 *  2. AuditLog에 AGENT_REGISTER_REQUEST 기록
 *  3. AX팀 알림 (현재: AuditLog 기록으로 대체)
 *  4. 202 Accepted 반환 — 실제 등록은 AX팀이 POST /api/registry 로 완료
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole()
  if ('error' in auth) return auth.error

  const body = await req.json()
  const { projectId, agentName, description, riskType, agentType } = body

  if (!projectId || !agentName) {
    return NextResponse.json(
      { error: 'projectId와 agentName은 필수입니다.' },
      { status: 400 }
    )
  }

  // riskType 3·4만 사전 등록 신청 대상 (AI-GUI-001 제16조)
  const parsedRiskType = riskType ? Number(riskType) : null
  if (parsedRiskType !== null && (parsedRiskType < 1 || parsedRiskType > 4)) {
    return NextResponse.json({ error: 'riskType은 1~4 사이여야 합니다.' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true, title: true, requesterEmail: true },
  })
  if (!project) {
    return NextResponse.json({ error: '연결된 과제를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!['pilot', 'production'].includes(project.status)) {
    return NextResponse.json(
      { error: `과제가 아직 승인되지 않았습니다. (현재 상태: ${project.status})` },
      { status: 400 }
    )
  }

  // AuditLog에 신청 기록 (AX팀이 조회하여 검토)
  await prisma.auditLog.create({
    data: {
      entityType: 'AgentRegistry',
      entityId: projectId,
      action: 'AGENT_REGISTER_REQUEST',
      actorEmail: auth.user.email,
      detail: JSON.stringify({
        projectId,
        projectTitle: project.title,
        agentName,
        description: description ?? '',
        riskType: parsedRiskType,
        agentType: agentType ?? null,
        requestedAt: new Date().toISOString(),
      }),
    },
  })

  return NextResponse.json(
    {
      message: '에이전트 등록 신청이 접수됐습니다. AX팀 검토 후 등록됩니다.',
      projectId,
      agentName,
      riskType: parsedRiskType,
      status: 'PENDING_REVIEW',
    },
    { status: 202 }
  )
}

/**
 * GET /api/registry/request
 * AX_TEAM: 대기 중인 등록 신청 목록 조회
 */
export async function GET() {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const requests = await prisma.auditLog.findMany({
    where: { action: 'AGENT_REGISTER_REQUEST' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, entityId: true, actorEmail: true, detail: true, createdAt: true },
  })

  const parsed = requests.map(r => ({
    id: r.id,
    projectId: r.entityId,
    actorEmail: r.actorEmail,
    createdAt: r.createdAt,
    ...(JSON.parse(r.detail ?? '{}')),
  }))

  return NextResponse.json({ requests: parsed, total: parsed.length })
}
