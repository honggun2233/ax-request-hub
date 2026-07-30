import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [agentProjectLinks, dataRequests] = await Promise.all([
      prisma.agentProjectLink.findMany({
        select: { id: true, agentId: true, projectId: true },
      }),
      prisma.dataRequest.findMany({
        where: { assetId: { not: null } },
        select: { id: true, projectId: true, agentId: true, assetId: true, status: true },
      }),
    ])

    const edges: { id: string; from: string; to: string; label: string }[] = []

    for (const link of agentProjectLinks) {
      edges.push({ id: link.id, from: link.agentId, to: link.projectId, label: 'BELONGS_TO' })
    }

    for (const req of dataRequests) {
      if (req.projectId && req.assetId) {
        edges.push({
          id: `proj-data-${req.id}`,
          from: req.projectId,
          to: req.assetId,
          label: 'USES_DATA',
        })
      }
      if (req.agentId && req.assetId) {
        edges.push({
          id: `agent-data-${req.id}`,
          from: req.agentId,
          to: req.assetId,
          label: 'CONSUMES',
        })
      }
    }

    return NextResponse.json(edges)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })
  }
}
