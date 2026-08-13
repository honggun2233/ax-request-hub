import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// P3-3a: EXECUTIVE 역할 분리 — AX_TEAM(ADMIN), C_LEVEL(경영진), EXECUTIVE(임원) 허용
const ALLOWED_ROLES = ['AX_TEAM', 'C_LEVEL', 'EXECUTIVE']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !ALLOWED_ROLES.includes((session.user as any)?.role)) {
    return NextResponse.json({ error: '권한 없음 — AX팀 또는 경영진만 접근 가능' }, { status: 403 })
  }

  try {
  const [
    agentByStage,
    projectByStatus,
    scorecards,
    costAgg,
    axProjects,
    agentLinks,
    auditLogs,
    employeeLevels,
    usageTrend,
  ] = await Promise.all([
    // 에이전트 Gate 단계별 카운트
    prisma.agentRegistry.groupBy({ by: ['lifecycleStage'], _count: { id: true } }),

    // 과제 상태별 카운트
    prisma.project.groupBy({ by: ['status'], _count: { id: true } }),

    // 평균 ScoreCard
    prisma.scoreCard.aggregate({
      _avg: { totalScore: true },
      _count: { id: true },
    }),

    // 누적 AI 비용
    prisma.usageRecord.aggregate({
      _sum: { costKrw: true, tokenUsed: true },
    }),

    // AXProject + 연결 에이전트 수
    prisma.aXProject.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { agents: true } },
      },
    }),

    // 각 프로젝트의 에이전트 단계 분포 (LEFT JOIN — 고아 링크 안전 처리)
    prisma.$queryRaw<{ projectId: string; lifecycleStage: string | null }[]>`
      SELECT apl."projectId", ar."lifecycleStage"
      FROM "AgentProjectLink" apl
      LEFT JOIN "AgentRegistry" ar ON ar.id = apl."agentId"
    `,

    // 최근 감사 로그 5건
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        action: true,
        entityType: true,
        detail: true,
        createdAt: true,
      },
    }),

    // 직원 AI 레벨 분포
    prisma.employee.groupBy({
      by: ['currentLevel'],
      where: { isActive: true },
      _count: { id: true },
    }),

    // 월별 비용 트렌드 (최근 6개월)
    prisma.usageRecord.groupBy({
      by: ['yearMonth'],
      _sum: { costKrw: true, tokenUsed: true },
      orderBy: { yearMonth: 'asc' },
    }),
  ])

  // Gate 단계 순서 정의
  const GATE_ORDER = ['DEVELOPING', 'GATE1', 'GATE2', 'GATE3', 'ACTIVE', 'DEPRECATED', 'RETIRED']
  const gateMap: Record<string, number> = {}
  agentByStage.forEach((g) => { gateMap[g.lifecycleStage] = g._count.id })

  // 과제 상태 집계
  const statusMap: Record<string, number> = {}
  projectByStatus.forEach((p) => { statusMap[p.status] = p._count.id })

  // 월별 비용 집계 (중복 yearMonth 제거)
  const seenMonths = new Set<string>()
  const monthlyCost = usageTrend
    .filter((u) => { if (seenMonths.has(u.yearMonth)) return false; seenMonths.add(u.yearMonth); return true })
    .slice(-6)
    .map((u) => ({
      month: u.yearMonth,
      cost: u._sum.costKrw ?? 0,
      tokens: u._sum.tokenUsed ?? 0,
    }))

  // AXProject별 에이전트 단계 집계 (lifecycleStage null = 고아 링크 → UNKNOWN)
  const projectAgentStages: Record<string, Record<string, number>> = {}
  agentLinks.forEach((link) => {
    const pid = link.projectId
    const stage = (link as any).lifecycleStage ?? 'UNKNOWN'
    if (!projectAgentStages[pid]) projectAgentStages[pid] = {}
    projectAgentStages[pid][stage] = (projectAgentStages[pid][stage] ?? 0) + 1
  })

  const axProjectsWithAgents = axProjects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    totalAgents: p._count.agents,
    activeAgents: projectAgentStages[p.id]?.ACTIVE ?? 0,
    gate3Agents: projectAgentStages[p.id]?.GATE3 ?? 0,
    gate2Agents: projectAgentStages[p.id]?.GATE2 ?? 0,
    gate1Agents: projectAgentStages[p.id]?.GATE1 ?? 0,
  }))

  // 레벨 분포
  const levelMap: Record<string, number> = {}
  employeeLevels.forEach((e) => { levelMap[e.currentLevel] = e._count.id })

  // Gate 통과율 계산
  const g1 = gateMap['GATE1'] ?? 0
  const g2 = gateMap['GATE2'] ?? 0
  const g3 = gateMap['GATE3'] ?? 0
  const active = gateMap['ACTIVE'] ?? 0
  const total = g1 + g2 + g3 + active + (gateMap['DEVELOPING'] ?? 0)
  const activationRate = total > 0 ? Math.round((active / total) * 100) : 0

  return NextResponse.json({
    // KPI 타일
    kpi: {
      activeAgents: active,
      totalAgents: Object.values(gateMap).reduce((a, b) => a + b, 0),
      productionProjects: (statusMap['production'] ?? 0) + (statusMap['pilot'] ?? 0),
      totalProjects: Object.values(statusMap).reduce((a, b) => a + b, 0),
      avgScore: Math.round(scorecards._avg.totalScore ?? 0),
      totalCostKrw: costAgg._sum.costKrw ?? 0,
      totalTokens: costAgg._sum.tokenUsed ?? 0,
      activationRate,
    },
    // Gate 퍼널
    gateFunnel: GATE_ORDER.map((stage) => ({
      stage,
      count: gateMap[stage] ?? 0,
    })).filter((g) => g.count > 0 || ['GATE1','GATE2','GATE3','ACTIVE'].includes(g.stage)),

    // 프로젝트 현황
    axProjects: axProjectsWithAgents,

    // 최근 감사로그
    auditLogs: auditLogs.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),

    // 직원 레벨 분포
    levelDistribution: ['L0', 'L1', 'L2', 'L3', 'L4'].map((level) => ({
      level,
      count: levelMap[level] ?? 0,
    })),

    // 월별 비용 트렌드
    monthlyCost,

    // 과제 퍼널
    projectFunnel: ['submitted', 'evaluated', 'pilot', 'production', 'closed'].map((s) => ({
      status: s,
      count: statusMap[s] ?? 0,
    })),
  })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })
  }
}
