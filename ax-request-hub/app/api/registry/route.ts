import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const LIFECYCLE_ORDER = ['DEVELOPING', 'GATE1', 'GATE2', 'GATE3', 'ACTIVE', 'DEGRADED', 'RETIRED']

export async function GET() {
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
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden — AX팀만 에이전트 등록 가능' }, { status: 403 })
  }
  const data = await req.json()
  const agent = await prisma.agentRegistry.create({ data })
  return NextResponse.json(agent, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden — AX팀만 에이전트 상태 변경 가능' }, { status: 403 })
  }
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
