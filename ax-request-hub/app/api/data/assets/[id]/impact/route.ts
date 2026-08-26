import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { getAffectedAgents } from '@/lib/impact-graph'

// GET /api/data/assets/[id]/impact
// 데이터 자산 회수 시 영향받는 에이전트 목록 (2-path 그래프 탐색)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole('AX_TEAM', 'DATA_PLATFORM')
  if ('error' in auth) return auth.error

  const { id } = await params

  const asset = await prisma.dataAsset.findUnique({
    where: { id },
    select: { id: true, name: true, classification: true },
  })
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  const affectedAgents = await getAffectedAgents(id)

  const byStage: Record<string, number> = {}
  let highRisk = 0
  for (const a of affectedAgents) {
    byStage[a.lifecycleStage] = (byStage[a.lifecycleStage] ?? 0) + 1
    if (a.riskLevel === 'HIGH') highRisk++
  }

  return NextResponse.json({
    assetId:        asset.id,
    assetName:      asset.name,
    classification: asset.classification,
    affectedAgents,
    summary: {
      total:    affectedAgents.length,
      highRisk,
      byStage,
    },
  })
}
