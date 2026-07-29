import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fromType = searchParams.get('fromType')
  const fromId = searchParams.get('fromId')

  const edges: { id: string; from: string; to: string; label: string }[] = []

  if (!fromType || fromType === 'Agent') {
    const [projectLinks, dataLinks] = await Promise.all([
      db.agentProjectLink.findMany({
        where: fromId ? { agentId: fromId } : undefined,
        select: { id: true, agentId: true, projectId: true },
      }),
      db.agentDataLink.findMany({
        where: fromId ? { agentId: fromId } : undefined,
        select: { id: true, agentId: true, dataAssetId: true },
      }),
    ])

    edges.push(
      ...projectLinks.map((l) => ({
        id: l.id,
        from: l.agentId,
        to: l.projectId,
        label: 'BELONGS_TO',
      }))
    )

    edges.push(
      ...dataLinks.map((l) => ({
        id: l.id,
        from: l.agentId,
        to: l.dataAssetId,
        label: 'CONSUMES',
      }))
    )
  }

  if (!fromType || fromType === 'Employee') {
    const employeeLinks = await db.employeeAgentLink.findMany({
      where: fromId ? { employeeId: fromId } : undefined,
      select: { id: true, employeeId: true, agentId: true },
    })

    edges.push(
      ...employeeLinks.map((l) => ({
        id: l.id,
        from: l.employeeId,
        to: l.agentId,
        label: 'MANAGES',
      }))
    )
  }

  return NextResponse.json(edges)
}
