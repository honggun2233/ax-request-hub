import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

export async function GET() {
  const projects = await db.project.findMany({
    include: { scoreCard: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const project = await db.project.create({ data: { ...body, source: 'ax_discovery' } })
  return NextResponse.json(project, { status: 201 })
}
