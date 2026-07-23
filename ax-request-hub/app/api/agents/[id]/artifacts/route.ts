import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const artifacts = await db.agentArtifact.findMany({
    where: { agentId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(artifacts)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden — AX팀만 아티팩트 추가 가능' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const { artifactType, title, contentPath, dataRetentionYears = 3 } = body

  const agent = await db.agent.findUnique({ where: { id } })
  const retainUntil = new Date()
  retainUntil.setFullYear(retainUntil.getFullYear() + (agent?.dataRetentionYears ?? dataRetentionYears))

  const artifact = await db.agentArtifact.create({
    data: { agentId: id, artifactType, title, contentPath, retainUntil },
  })
  return NextResponse.json(artifact, { status: 201 })
}
