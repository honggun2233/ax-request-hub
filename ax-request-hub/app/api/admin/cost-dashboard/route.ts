import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

// GET /api/admin/cost-dashboard?from=2026-08-01&to=2026-08-25
// A/B/C 3트랙 통합 비용 집계
export async function GET(req: NextRequest) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const sp = req.nextUrl.searchParams
  const from = sp.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const to   = sp.get('to')   ?? new Date().toISOString().slice(0, 10)

  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate   = new Date(`${to}T23:59:59.999Z`)

  // ── A-Track: Enterprise API pull (UsageRecordDaily) ─────────────────────
  const aRows = await prisma.usageRecordDaily.findMany({
    where: { date: { gte: from, lte: to } },
    select: { service: true, date: true, tokenUsed: true, costKrw: true },
  })
  const aByService: Record<string, { tokens: number; costKrw: number }> = {}
  let aTotalCost = 0
  let aTotalTokens = 0
  for (const r of aRows) {
    if (!aByService[r.service]) aByService[r.service] = { tokens: 0, costKrw: 0 }
    aByService[r.service].tokens  += r.tokenUsed
    aByService[r.service].costKrw += r.costKrw
    aTotalCost   += r.costKrw
    aTotalTokens += r.tokenUsed
  }

  // ── B-Track: AX Hub 엔진 호출 (GatewayCallLog) ─────────────────────────
  const bRows = await prisma.gatewayCallLog.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate } },
    select: { providerKey: true, taskType: true, totalTokens: true, costKrw: true, createdAt: true },
  })
  const bByProvider: Record<string, { tokens: number; costKrw: number }> = {}
  const bByTask: Record<string, { tokens: number; costKrw: number; count: number }> = {}
  let bTotalCost = 0
  let bTotalTokens = 0
  for (const r of bRows) {
    if (!bByProvider[r.providerKey]) bByProvider[r.providerKey] = { tokens: 0, costKrw: 0 }
    bByProvider[r.providerKey].tokens  += r.totalTokens
    bByProvider[r.providerKey].costKrw += Number(r.costKrw)
    if (r.taskType) {
      if (!bByTask[r.taskType]) bByTask[r.taskType] = { tokens: 0, costKrw: 0, count: 0 }
      bByTask[r.taskType].tokens  += r.totalTokens
      bByTask[r.taskType].costKrw += Number(r.costKrw)
      bByTask[r.taskType].count   += 1
    }
    bTotalCost   += Number(r.costKrw)
    bTotalTokens += r.totalTokens
  }

  // ── C-Track: 배포 에이전트 런타임 (AgentRuntimeUsage) ─────────────────
  const cRows = await prisma.agentRuntimeUsage.findMany({
    where: { calledAt: { gte: fromDate, lte: toDate } },
    select: { agentId: true, providerKey: true, tokenUsed: true, costKrw: true, calledAt: true },
  })
  const cByProvider: Record<string, { tokens: number; costKrw: number }> = {}
  const cByAgent: Record<string, { tokens: number; costKrw: number; calls: number }> = {}
  let cTotalCost = 0
  let cTotalTokens = 0
  for (const r of cRows) {
    if (!cByProvider[r.providerKey]) cByProvider[r.providerKey] = { tokens: 0, costKrw: 0 }
    cByProvider[r.providerKey].tokens  += r.tokenUsed
    cByProvider[r.providerKey].costKrw += Number(r.costKrw)
    if (!cByAgent[r.agentId]) cByAgent[r.agentId] = { tokens: 0, costKrw: 0, calls: 0 }
    cByAgent[r.agentId].tokens  += r.tokenUsed
    cByAgent[r.agentId].costKrw += Number(r.costKrw)
    cByAgent[r.agentId].calls   += 1
    cTotalCost   += Number(r.costKrw)
    cTotalTokens += r.tokenUsed
  }

  // C-track agentId → agentName 조회
  const agentIds = Object.keys(cByAgent)
  const agentNames: Record<string, string> = {}
  if (agentIds.length > 0) {
    const agents = await prisma.agentRegistry.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, agentName: true },
    })
    for (const a of agents) agentNames[a.id] = a.agentName
  }
  const cByAgentNamed = Object.fromEntries(
    Object.entries(cByAgent).map(([id, v]) => [agentNames[id] ?? id, v])
  )

  return NextResponse.json({
    period: { from, to },
    summary: {
      totalCostKrw: Math.round(aTotalCost + bTotalCost + cTotalCost),
      totalTokens:  aTotalTokens + bTotalTokens + cTotalTokens,
      a: { costKrw: Math.round(aTotalCost),   tokens: aTotalTokens,   records: aRows.length },
      b: { costKrw: Math.round(bTotalCost),   tokens: bTotalTokens,   records: bRows.length },
      c: { costKrw: Math.round(cTotalCost),   tokens: cTotalTokens,   records: cRows.length },
    },
    aTrack: { byService: aByService },
    bTrack: { byProvider: bByProvider, byTask: bByTask },
    cTrack: { byProvider: cByProvider, byAgent: cByAgentNamed },
  })
}
