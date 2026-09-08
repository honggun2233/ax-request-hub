import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { buildGate3UpdateData } from '@ssam/gate-transitions'
import { activateAgent } from '@ssam/agent-registry'

const LIFECYCLE_ORDER = ['DEVELOPING', 'GATE1', 'GATE2', 'SANDBOX_POC', 'GATE3', 'ACTIVE', 'DEGRADED', 'RETIRED']

export async function GET(req: NextRequest) {
  const auth = await requireRole()
  if ('error' in auth) return auth.error

  try {
    const url = new URL(req.url)
    const systemOnly = url.searchParams.get('systemOnly') === '1'

    const agents = await prisma.agentRegistry.findMany({
      where: systemOnly ? { isSystemAgent: true } : undefined,
      include: {
        scores: { orderBy: { recordedAt: 'desc' }, take: 5 },
        projects: { include: { project: true } },
      },
      orderBy: { agentName: 'asc' },
    })

    const stageCounts = LIFECYCLE_ORDER.reduce((acc, s) => ({ ...acc, [s]: 0 }), {} as Record<string, number>)
    agents.forEach(a => { if (stageCounts[a.lifecycleStage] !== undefined) stageCounts[a.lifecycleStage]++ })

    return NextResponse.json({ agents, stageCounts })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error
  const data = await req.json()

  // Phase B — Q2=A: 승인된 과제 연결 필수
  if (!data.projectId) {
    return NextResponse.json(
      { error: '승인된 AI 활용 과제를 연결해야 합니다. /me/projects 에서 과제 승인 후 등록하세요.' },
      { status: 400 }
    )
  }
  const project = await prisma.project.findUnique({ where: { id: data.projectId } })
  if (!project) {
    return NextResponse.json({ error: '연결된 과제를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!['pilot', 'production'].includes(project.status)) {
    return NextResponse.json(
      { error: `과제가 아직 승인되지 않았습니다. (현재 상태: ${project.status}) 승인 후 에이전트를 등록하세요.` },
      { status: 400 }
    )
  }

  // 허용된 필드만 명시적으로 추출 (Mass Assignment 방지 — gate*Passed, lifecycleStage 등 서버 전용 필드 차단)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeData: any = {
    agentName: data.agentName,
    projectId: data.projectId,
    ...(data.agentId      !== undefined && { agentId: data.agentId }),
    ...(data.agentType    !== undefined && { agentType: data.agentType }),
    ...(data.phase        !== undefined && { phase: data.phase }),
    ...(data.devStage     !== undefined && { devStage: data.devStage }),
    ...(data.prodStatus   !== undefined && { prodStatus: data.prodStatus }),
    ...(data.description  !== undefined && { description: data.description }),
    ...(data.modelVersion !== undefined && { modelVersion: data.modelVersion }),
    ...(data.department   !== undefined && { department: data.department }),
    ...(data.riskType     !== undefined && { riskType: data.riskType === null ? null : Number(data.riskType) }),
  }
  const agent = await prisma.agentRegistry.create({ data: safeData })
  return NextResponse.json(agent, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error
  const { id, lifecycleStage, operatorTrustScore, operatorComment, sam30dAccuracy, retireReason } = await req.json()
  const now = new Date()

  // ACTIVE 전환 — activateAgent가 단일 트랜잭션 내에서 모든 필드를 원자적으로 처리
  if (lifecycleStage === 'ACTIVE') {
    const agent = await prisma.$transaction(async (tx) => {
      return activateAgent(tx, id, { operatorTrustScore, operatorComment, sam30dAccuracy })
    })
    return NextResponse.json(agent)
  }

  const updateData: any = { lifecycleStage, updatedAt: now }

  // GATE2 전환 가드 (GATE1에서만, 단계 점프 불허)
  if (lifecycleStage === 'GATE2') {
    const current = await prisma.agentRegistry.findUnique({ where: { id }, select: { projectId: true, lifecycleStage: true } })
    if (current?.lifecycleStage === 'GATE1') {
      // 데이터 하드블록 — projectId 있을 때만 (데이터 신청은 projectId 필수)
      if (current.projectId) {
        const unprovisionedCount = await prisma.dataRequest.count({
          where: { projectId: current.projectId, status: { notIn: ['PROVISIONED', 'REJECTED', 'REVOKED'] } },
        })
        if (unprovisionedCount > 0) {
          return NextResponse.json(
            { error: `데이터 신청 ${unprovisionedCount}건이 미제공(PROVISIONED 미완료) 상태입니다. 데이터 제공 완료 후 GATE2로 전환하세요.` },
            { status: 422 }
          )
        }
      }

      // [B-1] 기술표준 하드블록 — projectId 없으면 검증 불가 → 차단
      const project = current.projectId
        ? await prisma.project.findUnique({
            where: { id: current.projectId },
            select: { techStandardsPassed: true, techStandardsFailedItems: true },
          })
        : null
      if (!project?.techStandardsPassed) {
        const failedItems: string[] = project?.techStandardsFailedItems
          ? JSON.parse(project.techStandardsFailedItems)
          : []
        return NextResponse.json(
          {
            error: 'GATE2 전환 불가 — 기술표준 미충족',
            failedItems,
            guide: 'AX팀 검토 화면(/registry)에서 Gate2 체크리스트를 완료하거나, 신청자가 /projects/new에서 항목을 보완 후 재제출하세요.',
          },
          { status: 422 }
        )
      }
    }
  }

  if (lifecycleStage === 'GATE1') {
    updateData.gate1Passed = true
    updateData.gate1PassedAt = now
  }
  if (lifecycleStage === 'GATE3') {
    const current = await prisma.agentRegistry.findUnique({
      where: { id },
      select: { lifecycleStage: true, sandboxCompletedAt: true },
    })
    if (current?.lifecycleStage !== 'SANDBOX_POC' || !current.sandboxCompletedAt) {
      return NextResponse.json(
        { error: 'SANDBOX_POC 단계에서 PoC를 완료해야 GATE3로 전환할 수 있습니다.' },
        { status: 422 }
      )
    }
    Object.assign(updateData, buildGate3UpdateData(now))
  }
  if (lifecycleStage === 'DEGRADED') updateData.degradedSince = now
  if (lifecycleStage === 'RETIRED') { updateData.retiredAt = now; updateData.retireReason = retireReason }

  const agent = await prisma.agentRegistry.update({ where: { id }, data: updateData })

  // RETIRED 전환 시 연결 과제 status → 'closed' 동기화 + 데이터 제공 전건 회수 (v3 §9-3)
  if (lifecycleStage === 'RETIRED' && agent.projectId) {
    await prisma.project.update({
      where: { id: agent.projectId },
      data: { status: 'closed' },
    }).catch(() => {})

    // 연결 과제의 DataProvision 전건 REVOKED 처리
    const dataRequests = await prisma.dataRequest.findMany({
      where: { projectId: agent.projectId, status: 'PROVISIONED' },
      select: { id: true },
    })
    const requestIds = dataRequests.map((r: { id: string }) => r.id)
    if (requestIds.length > 0) {
      const revokeNow = new Date()
      await prisma.dataProvision.updateMany({
        where: { requestId: { in: requestIds }, revokedAt: null },
        data: { revokedAt: revokeNow, revokeReason: `에이전트 폐기(RETIRED): ${agent.agentName ?? id}` },
      })
      await prisma.dataRequest.updateMany({
        where: { id: { in: requestIds } },
        data: { status: 'REVOKED' },
      })
      await prisma.auditLog.create({
        data: {
          entityType: 'AgentRegistry',
          entityId: id,
          action: 'DATA_PROVISIONS_REVOKED_ON_RETIRE',
          actorEmail: auth.user.email,
          detail: JSON.stringify({ revokedRequestCount: requestIds.length, projectId: agent.projectId }),
        },
      })
    }
  }

  // Phase C — Q3=B: Gate 2 진입 시 데이터 승인 상태 확인 (경고 반환, 차단 아님)
  let dataWarning: { pendingCount: number; totalCount: number } | null = null
  if (lifecycleStage === 'GATE2' && agent.projectId) {
    const [total, pending] = await Promise.all([
      prisma.dataRequest.count({ where: { projectId: agent.projectId } }),
      prisma.dataRequest.count({
        where: { projectId: agent.projectId, status: { in: ['DRAFT', 'PENDING'] } },
      }),
    ])
    if (total > 0 && pending > 0) {
      dataWarning = { pendingCount: pending, totalCount: total }
    }
  }

  return NextResponse.json({ ...agent, dataWarning })
}
