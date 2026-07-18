import { NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

export async function GET() {
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
    db.agentRegistry.groupBy({ by: ['lifecycleStage'], _count: { id: true } }),

    // 과제 상태별 카운트
    db.project.groupBy({ by: ['status'], _count: { id: true } }),

    // 평균 ScoreCard
    db.scoreCard.aggregate({
      _avg: { totalScore: true },
      _count: { id: true },
    }),

    // 누적 AI 비용
    db.usageRecord.aggregate({
      _sum: { costKrw: true, tokenUsed: true },
    }),

    // AXProject + 연결 에이전트 수
    db.aXProject.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { agents: true } },
      },
    }),

    // 각 프로젝트의 에이전트 단계 분포
    db.agentProjectLink.findMany({
      select: {
        projectId: true,
        agent: { select: { lifecycleStage: true } },
      },
    }),

    // 최근 감사 로그 5건
    db.auditLog.findMany({
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
    db.employee.groupBy({
      by: ['currentLevel'],
      where: { isActive: true },
      _count: { id: true },
    }),

    // 월별 비용 트렌드 (최근 6개월)
    db.usageRecord.groupBy({
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

  // 월별 비용 집계
  const monthlyCost = usageTrend
    .slice(-6)
    .map((u) => ({
      month: u.yearMonth,
      cost: u._sum.costKrw ?? 0,
      tokens: u._sum.tokenUsed ?? 0,
    }))

  // AXProject별 에이전트 단계 집계
  const projectAgentStages: Record<string, Record<string, number>> = {}
  agentLinks.forEach((link) => {
    const pid = link.projectId
    const stage = link.agent?.lifecycleStage ?? 'UNKNOWN'
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
}
