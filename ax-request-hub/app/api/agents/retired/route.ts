import { NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

export async function GET() {
  const agents = await db.agent.findMany({
    where: { status: { in: ['DEPRECATED', 'RETIRED'] } },
    include: { artifacts: true, knowledgeExtracts: true },
    orderBy: { deprecatedAt: 'desc' },
  })
  return NextResponse.json(agents)
}
