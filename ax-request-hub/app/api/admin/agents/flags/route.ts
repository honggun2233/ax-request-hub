import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { displayName } from '@/lib/council-eligibility'

/**
 * GET /api/admin/agents/flags
 * WARNING/RETIRE_CANDIDATE 플래그 에이전트 목록.
 * 레거시 Agent.performanceFlag + AgentRegistry.retireFlag 양쪽 포함.
 */
export async function GET() {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  try {
    const [legacyFlagged, registryFlagged] = await Promise.all([
      // 레거시 Agent 모델
      prisma.agent.findMany({
        where: { performanceFlag: { not: null } },
        select: {
          id: true, name: true, department: true, status: true,
          kpiName: true, kpiTarget: true, kpiLastScore: true, kpiMissCount: true,
          performanceFlag: true, lastUsedAt: true, updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      // v3 AgentRegistry 모델 — retireFlag=true
      prisma.agentRegistry.findMany({
        where: { retireFlag: true },
        include: { scores: { where: { phase: 'PRODUCTION', month: { not: null } }, orderBy: { month: 'desc' }, take: 3 } },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    const registryResult = registryFlagged.map((a) => ({
      id: a.id,
      name: displayName(a),
      department: a.owner ?? null,
      phase: a.phase,
      lifecycleStage: a.lifecycleStage,
      prodStatus: a.prodStatus,
      performanceFlag: 'RETIRE_CANDIDATE',
      recentScores: a.scores.map((s) => ({ month: s.month, achieveRate: s.achieveRate })),
      updatedAt: a.updatedAt,
      source: 'AgentRegistry' as const,
    }))

    return NextResponse.json({
      legacy: legacyFlagged,
      registry: registryResult,
    })
  } catch (err: any) {
    console.error('[admin/agents/flags GET]', err)
    return NextResponse.json({ error: err?.message ?? 'unknown' }, { status: 500 })
  }
}
