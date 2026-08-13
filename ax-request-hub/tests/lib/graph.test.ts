import { traverse } from '@/lib/graph/traverse'
import { severityOf } from '@/lib/graph/assemble'
import type { Graph, GraphNode, NodeKey } from '@/lib/graph/types'

function makeNode(type: GraphNode['type'], id: string, meta: Record<string, unknown> = {}): GraphNode {
  return { key: `${type}:${id}` as NodeKey, type, id, label: `${type}-${id}`, meta }
}

function makeGraph(nodes: GraphNode[], ...extras: Parameters<typeof makeNode>[]): Graph {
  const nodeMap = new Map<NodeKey, GraphNode>()
  for (const n of nodes) nodeMap.set(n.key, n)
  return { nodes: nodeMap, edges: [] }
}

// ─── traverse ─────────────────────────────────────────────────────────────────

describe('traverse', () => {
  test('empty graph returns empty array', () => {
    const graph: Graph = { nodes: new Map(), edges: [] }
    const result = traverse(graph, 'agent:x' as NodeKey, { maxHops: 3, allowedEdges: ['AGENT_DATA'] })
    expect(result).toEqual([])
  })

  test('maxHops=1 only returns direct neighbors', () => {
    const a = makeNode('agent', 'a1')
    const b = makeNode('asset', 'b1')
    const c = makeNode('asset', 'c1')
    const graph: Graph = {
      nodes: new Map([
        [a.key, a],
        [b.key, b],
        [c.key, c],
      ]),
      edges: [
        { from: 'agent:a1', to: 'asset:b1', type: 'AGENT_DATA' },
        { from: 'asset:b1', to: 'asset:c1', type: 'AGENT_DATA' },
      ],
    }
    const result = traverse(graph, 'agent:a1', { maxHops: 1, allowedEdges: ['AGENT_DATA'] })
    expect(result).toHaveLength(1)
    expect(result[0].node.key).toBe('asset:b1')
    expect(result[0].hops).toBe(1)
  })

  test('cyclic graph does not loop infinitely', () => {
    const a = makeNode('agent', 'a1')
    const b = makeNode('agent', 'a2')
    const graph: Graph = {
      nodes: new Map([
        [a.key, a],
        [b.key, b],
      ]),
      edges: [
        { from: 'agent:a1', to: 'agent:a2', type: 'AGENT_PROJECT' },
        { from: 'agent:a2', to: 'agent:a1', type: 'AGENT_PROJECT' },
      ],
    }
    const result = traverse(graph, 'agent:a1', { maxHops: 10, allowedEdges: ['AGENT_PROJECT'] })
    expect(result).toHaveLength(1)
    expect(result[0].node.key).toBe('agent:a2')
  })

  test('retired node excluded by default (includeRetired=false)', () => {
    const a = makeNode('agent', 'a1')
    const b = makeNode('agent', 'b1', { retired: true })
    const graph: Graph = {
      nodes: new Map([
        [a.key, a],
        [b.key, b],
      ]),
      edges: [{ from: 'agent:a1', to: 'agent:b1', type: 'AGENT_PROJECT' }],
    }
    const result = traverse(graph, 'agent:a1', { maxHops: 3, allowedEdges: ['AGENT_PROJECT'] })
    expect(result).toHaveLength(0)
  })

  test('retired node included when includeRetired=true', () => {
    const a = makeNode('agent', 'a1')
    const b = makeNode('agent', 'b1', { retired: true })
    const graph: Graph = {
      nodes: new Map([
        [a.key, a],
        [b.key, b],
      ]),
      edges: [{ from: 'agent:a1', to: 'agent:b1', type: 'AGENT_PROJECT' }],
    }
    const result = traverse(graph, 'agent:a1', {
      maxHops: 3,
      allowedEdges: ['AGENT_PROJECT'],
      includeRetired: true,
    })
    expect(result).toHaveLength(1)
    expect(result[0].node.key).toBe('agent:b1')
  })

  test('duplicate edges do not produce duplicate results', () => {
    const a = makeNode('agent', 'a1')
    const b = makeNode('asset', 'b1')
    const graph: Graph = {
      nodes: new Map([
        [a.key, a],
        [b.key, b],
      ]),
      edges: [
        { from: 'agent:a1', to: 'asset:b1', type: 'AGENT_DATA' },
        { from: 'agent:a1', to: 'asset:b1', type: 'AGENT_DATA' },
      ],
    }
    const result = traverse(graph, 'agent:a1', { maxHops: 3, allowedEdges: ['AGENT_DATA'] })
    expect(result).toHaveLength(1)
  })
})

// ─── severityOf ───────────────────────────────────────────────────────────────

describe('severityOf', () => {
  test('ACTIVE status → HIGH', () => {
    const node = makeNode('agent', 'x', { status: 'ACTIVE' })
    expect(severityOf(node)).toBe('HIGH')
  })

  test('DEGRADED status → HIGH', () => {
    const node = makeNode('agent', 'x', { status: 'DEGRADED' })
    expect(severityOf(node)).toBe('HIGH')
  })

  test('GATE3 lifecycleStage (non-ACTIVE/DEGRADED) → MEDIUM', () => {
    const node = makeNode('agent', 'x', { status: 'DEVELOPING', lifecycleStage: 'GATE3' })
    expect(severityOf(node)).toBe('MEDIUM')
  })

  test('GATE2 lifecycleStage → MEDIUM', () => {
    const node = makeNode('agent', 'x', { status: 'DEVELOPING', lifecycleStage: 'GATE2' })
    expect(severityOf(node)).toBe('MEDIUM')
  })

  test('DEVELOPING status with no special stage → LOW', () => {
    const node = makeNode('agent', 'x', { status: 'DEVELOPING', lifecycleStage: 'GATE1' })
    expect(severityOf(node)).toBe('LOW')
  })
})
