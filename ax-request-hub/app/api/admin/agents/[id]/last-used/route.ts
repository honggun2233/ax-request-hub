import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT /api/admin/agents/:id/last-used
// 에이전트 호출 시 lastUsedAt 갱신
export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentId } = await params

    const agent = await prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const updated = await prisma.agent.update({
      where: { id: agentId },
      data: { lastUsedAt: new Date() },
    })

    return NextResponse.json({ id: updated.id, lastUsedAt: updated.lastUsedAt })
  } catch (err: any) {
    console.error('[admin/agents/:id/last-used PUT]', err)
    return NextResponse.json({ error: err?.message ?? 'unknown' }, { status: 500 })
  }
}
