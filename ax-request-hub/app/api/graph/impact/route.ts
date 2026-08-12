import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, Role } from '@/lib/authz'
import { getGraph } from '@/lib/graph/cache'
import { traverse } from '@/lib/graph/traverse'
import { assembleResult } from '@/lib/graph/assemble'
import { prisma } from '@/lib/prisma'
import type { NodeType, EdgeType, NodeKey } from '@/lib/graph/types'

const ALLOWED_ROLES: Role[] = ['DEPT_HEAD', 'AX_TEAM', 'C_LEVEL', 'EXECUTIVE', 'DATA_PLATFORM']

const ALL_EDGES: EdgeType[] = [
  'AGENT_DATA',
  'AGENT_AXPROJECT',
  'AGENT_PROJECT',
  'EMPLOYEE_AGENT',
  'ASSET_OWNER',
]

const DEFAULT_HOPS = 3
const MIN_HOPS = 1
const MAX_HOPS = 5

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as NodeType | null
  const id = searchParams.get('id')

  if (!type || !id) {
    return NextResponse.json({ error: 'type and id are required' }, { status: 400 })
  }

  const rawHops = parseInt(searchParams.get('hops') ?? '', 10)
  const hops = isNaN(rawHops)
    ? DEFAULT_HOPS
    : Math.min(MAX_HOPS, Math.max(MIN_HOPS, rawHops))

  const graph = await getGraph()
  const nodeKey: NodeKey = `${type}:${id}`
  const originNode = graph.nodes.get(nodeKey)

  if (!originNode) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  }

  const hits = traverse(graph, nodeKey, {
    maxHops: hops,
    allowedEdges: ALL_EDGES,
    includeRetired: false,
  })

  const result = assembleResult(originNode, hits, user.role)

  await prisma.auditLog.create({
    data: {
      entityType: type,
      entityId: id,
      action: 'GRAPH_IMPACT_VIEW',
      actorEmail: user.email,
      detail: JSON.stringify({ hops, role: user.role }),
    },
  })

  return NextResponse.json(result)
}
