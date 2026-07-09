import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; artifactId: string }> }
) {
  const { artifactId } = await params
  const artifact = await db.agentArtifact.findUnique({ where: { id: artifactId } })
  if (!artifact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (new Date() < new Date(artifact.retainUntil)) {
    return NextResponse.json({ error: '보존기간 미만료' }, { status: 400 })
  }

  await db.agentArtifact.delete({ where: { id: artifactId } })
  return NextResponse.json({ ok: true })
}
