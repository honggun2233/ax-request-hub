import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const agents = await prisma.agent.findMany({
    where: { status: { in: ['DEPRECATED', 'RETIRED'] } },
    include: { artifacts: true, knowledgeExtracts: true },
    orderBy: { deprecatedAt: 'desc' },
  })
  return NextResponse.json(agents)
}
