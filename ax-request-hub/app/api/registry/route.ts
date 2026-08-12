import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

const LIFECYCLE_ORDER = ['DEVELOPING', 'GATE1', 'GATE2', 'GATE3', 'ACTIVE', 'DEGRADED', 'RETIRED']

export async function GET() {
  const auth = await requireRole()
  if ('error' in auth) return auth.error

  try {
    const agents = await prisma.agentRegistry.findMany({
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
  }
  const agent = await prisma.agentRegistry.create({ data: safeData })
  return NextResponse.json(agent, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error
  const { id, lifecycleStage, operatorTrustScore, operatorComment, sam30dAccuracy, retireReason } = await req.json()
  const now = new Date()
  const updateData: any = { lifecycleStage, updatedAt: now }

  if (lifecycleStage === 'ACTIVE' && operatorTrustScore) {
    updateData.gate2Passed = true
    updateData.gate2PassedAt = now
    updateData.operatorTrustScore = operatorTrustScore
    updateData.operatorComment = operatorComment
    updateData.sam30dAccuracy = sam30dAccuracy
  }
  if (lifecycleStage === 'GATE1') {
    updateData.gate1Passed = true
    updateData.gate1PassedAt = now
  }
  if (lifecycleStage === 'GATE3') {
    updateData.gate3Passed = true
    updateData.gate3PassedAt = now
  }
  if (lifecycleStage === 'DEGRADED') updateData.degradedSince = now
  if (lifecycleStage === 'RETIRED') { updateData.retiredAt = now; updateData.retireReason = retireReason }

  const agent = await prisma.agentRegistry.update({ where: { id }, data: updateData })

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
