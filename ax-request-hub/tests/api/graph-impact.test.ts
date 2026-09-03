import { NextRequest } from 'next/server'
import { GET } from '@/app/api/graph/impact/route'
import type { Graph, GraphNode, NodeKey } from '@/lib/graph/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSessionUser = jest.fn()
jest.mock('@/lib/authz', () => ({
  getSessionUser: (...args: unknown[]) => mockGetSessionUser(...args),
}))

const mockGetGraph = jest.fn()
jest.mock('@/lib/graph/cache', () => ({
  getGraph: (...args: unknown[]) => mockGetGraph(...args),
}))

const mockAuditLogCreate = jest.fn().mockResolvedValue({})
jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNode(type: GraphNode['type'], id: string, meta: Record<string, unknown> = {}): GraphNode {
  return { key: `${type}:${id}` as NodeKey, type, id, label: `${type}-${id}`, meta }
}

function makeMinimalGraph(): Graph {
  return { nodes: new Map(), edges: [] }
}

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/graph/impact')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

function mockUser(role: string) {
  mockGetSessionUser.mockResolvedValue({
    id: 'emp-1',
    employeeId: 'E001',
    email: 'test@example.com',
    name: '테스터',
    role,
    department: '운영팀',
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuditLogCreate.mockResolvedValue({})
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/graph/impact', () => {
  test('no auth → 401', async () => {
    mockGetSessionUser.mockResolvedValue(null)
    const req = makeRequest({ type: 'agent', id: 'a1' })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  test('EMPLOYEE role → 403', async () => {
    mockUser('EMPLOYEE')
    const req = makeRequest({ type: 'agent', id: 'a1' })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  test('missing type param → 400', async () => {
    mockUser('AX_TEAM')
    const req = makeRequest({ id: 'a1' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  test('unknown id → 404', async () => {
    mockUser('AX_TEAM')
    mockGetGraph.mockResolvedValue(makeMinimalGraph())
    const req = makeRequest({ type: 'agent', id: 'nonexistent' })
    const res = await GET(req)
    expect(res.status).toBe(404)
  })

  test('hops out of range is clamped → 200', async () => {
    mockUser('AX_TEAM')
    const agent = makeNode('agent', 'a1', { status: 'ACTIVE' })
    const graph: Graph = {
      nodes: new Map([[agent.key, agent]]),
      edges: [],
    }
    mockGetGraph.mockResolvedValue(graph)
    // hops=99 exceeds max; should clamp and succeed
    const req = makeRequest({ type: 'agent', id: 'a1', hops: '99' })
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  test('C_LEVEL role + G3 asset in graph → warnings contains G3 notice', async () => {
    mockUser('C_LEVEL')
    const agent = makeNode('agent', 'a1', { status: 'ACTIVE' })
    const asset = makeNode('asset', 'g3-asset', { classification: 'CONFIDENTIAL', isActive: true })
    const graph: Graph = {
      nodes: new Map([
        [agent.key, agent],
        [asset.key, asset],
      ]),
      edges: [{ from: 'agent:a1', to: 'asset:g3-asset', type: 'AGENT_DATA' }],
    }
    mockGetGraph.mockResolvedValue(graph)
    const req = makeRequest({ type: 'agent', id: 'a1', hops: '3' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.warnings).toBeDefined()
    expect(Array.isArray(data.warnings)).toBe(true)
    expect(data.warnings.some((w: string) => w.includes('CONFIDENTIAL'))).toBe(true)
  })
})
