import { NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

export async function GET() {
  try {
    const agents = await db.agent.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(agents)
  } catch (err: any) {
    console.error('[admin/agents GET]', err)
    return NextResponse.json({ error: err?.message ?? 'unknown' }, { status: 500 })
  }
}

export async function POST(req: Request) {
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
    const agent = await db.agent.create({
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
