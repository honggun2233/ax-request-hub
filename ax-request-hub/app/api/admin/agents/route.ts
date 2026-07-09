import { NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

export async function GET() {
  const agents = await db.agent.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(agents)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { name, department, description } = body
  if (!name || !department) {
    return NextResponse.json({ error: 'name and department are required' }, { status: 400 })
  }
  const agent = await db.agent.create({
    data: { name, department, description: description || '' },
  })
  return NextResponse.json(agent, { status: 201 })
}
