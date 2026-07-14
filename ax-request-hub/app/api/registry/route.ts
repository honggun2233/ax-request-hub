import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const agents = await prisma.agentRegistry.findMany({
    include: { scores: { orderBy: { recordedAt: 'desc' }, take: 5 } },
    orderBy: { agentName: 'asc' },
  })
  return NextResponse.json(agents)
}

export async function POST(req: Request) {
  const data = await req.json()
  const agent = await prisma.agentRegistry.create({ data })
  return NextResponse.json(agent, { status: 201 })
}
