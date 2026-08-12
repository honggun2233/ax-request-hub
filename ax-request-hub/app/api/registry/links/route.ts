import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidateGraph } from '@/lib/graph/cache'

// POST: 에이전트-프로젝트 링크 추가
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden — AX팀만 링크 추가 가능' }, { status: 403 })
  }
  const { agentId, projectId, role = 'PRIMARY' } = await req.json()
  if (!agentId || !projectId) {
    return NextResponse.json({ error: 'agentId, projectId 필수' }, { status: 400 })
  }

  const link = await prisma.agentProjectLink.upsert({
    where: { agentId_projectId: { agentId, projectId } },
    update: { role },
    create: { agentId, projectId, role },
    include: { project: true },
  })

  invalidateGraph()
  return NextResponse.json(link, { status: 201 })
}

// DELETE: 링크 제거
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden — AX팀만 링크 제거 가능' }, { status: 403 })
  }
  const { agentId, projectId } = await req.json()
  if (!agentId || !projectId) {
    return NextResponse.json({ error: 'agentId, projectId 필수' }, { status: 400 })
  }

  await prisma.agentProjectLink.delete({
    where: { agentId_projectId: { agentId, projectId } },
  })

  invalidateGraph()
  return NextResponse.json({ ok: true })
}
