import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        registry: {
          select: { id: true, retireFlag: true },
        },
      },
    })
    // flatten registry fields into each agent object for convenience
    const result = agents.map((a) => ({
      ...a,
      agentRegistryId: a.agentRegistryId ?? null,
      retireFlag: a.registry?.retireFlag ?? null,
    }))
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[admin/agents GET]', err)
    return NextResponse.json({ error: err?.message ?? 'unknown' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const {
      name,
      department,
      description,
      kpiName,
      kpiTarget,
      kpiType,
      kpiMeasureMethod,
      kpiMeasureCycle,
    } = body
    if (!name || !department) {
      return NextResponse.json({ error: 'name and department are required' }, { status: 400 })
    }
    const agent = await prisma.agent.create({
      data: {
        name,
        department,
        description: description || '',
        kpiName: kpiName ?? null,
        kpiTarget: kpiTarget != null ? Number(kpiTarget) : null,
        kpiType: kpiType ?? null,
        kpiMeasureMethod: kpiMeasureMethod ?? null,
        kpiMeasureCycle: kpiMeasureCycle ?? 'MONTHLY',
      },
    })
    return NextResponse.json(agent, { status: 201 })
  } catch (err: any) {
    console.error('[admin/agents POST]', err)
    return NextResponse.json({ error: err?.message ?? 'unknown' }, { status: 500 })
  }
}
