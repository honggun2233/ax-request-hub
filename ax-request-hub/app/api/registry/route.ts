import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const LIFECYCLE_ORDER = ['DEVELOPING', 'GATE1', 'GATE2', 'GATE3', 'ACTIVE', 'DEGRADED', 'RETIRED']

export async function GET() {
  const agents = await prisma.agentRegistry.findMany({
    include: { scores: { orderBy: { recordedAt: 'desc' }, take: 5 } },
    orderBy: { agentName: 'asc' },
  })

  const stageCounts = LIFECYCLE_ORDER.reduce((acc, s) => ({ ...acc, [s]: 0 }), {} as Record<string, number>)
  agents.forEach(a => { if (stageCounts[a.lifecycleStage] !== undefined) stageCounts[a.lifecycleStage]++ })

  return NextResponse.json({ agents, stageCounts })
}

export async function POST(req: Request) {
  const data = await req.json()
  const agent = await prisma.agentRegistry.create({ data })
  return NextResponse.json(agent, { status: 201 })
}

export async function PATCH(req: Request) {
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
  if (lifecycleStage === 'DEGRADED') updateData.degradedSince = now
  if (lifecycleStage === 'RETIRED') { updateData.retiredAt = now; updateData.retireReason = retireReason }

  const agent = await prisma.agentRegistry.update({ where: { id }, data: updateData })
  return NextResponse.json(agent)
}
