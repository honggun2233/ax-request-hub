import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGraph } from '@/lib/graph/cache'
import { SCENARIOS } from '@/lib/graph/scenarios'
import { traverse } from '@/lib/graph/traverse'
import { assembleResult } from '@/lib/graph/assemble'

const ALLOWED_ROLES = ['AX_TEAM', 'DATA_PLATFORM', 'C_LEVEL', 'EXECUTIVE']
const VALID_TYPES = ['asset', 'agent', 'employee'] as const
type ValidType = typeof VALID_TYPES[number]

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !ALLOWED_ROLES.includes((session.user as any)?.role)) {
    return NextResponse.json({ error: '권한 없음 — 접근이 허용되지 않습니다.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const typeParam = searchParams.get('type')
  const id = searchParams.get('id')
  const hopsParam = searchParams.get('hops')
  const includeRetiredParam = searchParams.get('includeRetired')

  if (!typeParam || !VALID_TYPES.includes(typeParam as ValidType)) {
    return NextResponse.json({ error: 'type은 asset | agent | employee 중 하나여야 합니다.' }, { status: 400 })
  }
  const type = typeParam as ValidType

  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  }

  const scenario = SCENARIOS[type]

  let hops = scenario.defaultHops
  if (hopsParam !== null) {
    const parsed = parseInt(hopsParam, 10)
    if (!isNaN(parsed)) {
      hops = Math.max(1, Math.min(4, parsed))
    }
  }

  const includeRetired = includeRetiredParam === 'true'

  const graph = await getGraph()
  const nodeKey = `${type}:${id}`
  const originNode = graph.nodes.get(nodeKey)

  if (!originNode) {
    return NextResponse.json({ error: `노드를 찾을 수 없습니다: ${nodeKey}` }, { status: 404 })
  }

  const hits = traverse(graph, nodeKey, {
    maxHops: hops,
    allowedEdges: scenario.allowedEdges,
    includeRetired,
  })

  const userRole = (session.user as any)?.role ?? ''
  const result = assembleResult(originNode, hits, userRole)

  prisma.auditLog.create({
    data: {
      entityType: 'Graph',
      entityId: id,
      action: 'IMPACT_QUERY',
      actorEmail: (session.user as any)?.email ?? 'unknown',
      detail: JSON.stringify({ type, id, hops }),
    },
  }).catch(() => {})

  return NextResponse.json(result)
}
