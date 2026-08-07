'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import cytoscape, { type Core, type NodeSingular, type ElementDefinition } from 'cytoscape'

// ─── 타입 ───────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  type: 'Project' | 'Agent' | 'DataAsset' | 'Employee'
  name: string
  status?: string
  secretLevel?: 'G1' | 'G2' | 'G3'
  dept?: string
  lifecycleStage?: string
}

interface GraphEdge {
  id: string
  from: string
  to: string
  label: string
}

interface OverviewData {
  totalNodes: number
  byType: Record<string, number>
}

// ─── 색상 팔레트 ────────────────────────────────────────────────────────────

const NODE_COLORS: Record<GraphNode['type'], string> = {
  Project: '#4F46E5',
  Agent: '#059669',
  DataAsset: '#6B7280',
  Employee: '#7C3AED',
}

const SECRET_LEVEL_COLORS: Record<string, string> = {
  G1: '#6B7280',
  G2: '#D97706',
  G3: '#DC2626',
}

// ─── Mock 데이터 (API 미구현 시 폴백) ────────────────────────────────────────

const MOCK_NODES: GraphNode[] = [
  { id: 'p1', type: 'Project', name: '컴플라이언스 자동화', status: 'ACTIVE' },
  { id: 'p2', type: 'Project', name: 'ETF 리포트 생성', status: 'PILOT' },
  { id: 'a1', type: 'Agent', name: 'ComplianceAgent', lifecycleStage: 'PRODUCTION' },
  { id: 'a2', type: 'Agent', name: 'ReportAgent', lifecycleStage: 'GATE2' },
  { id: 'd1', type: 'DataAsset', name: '규정집 DB', secretLevel: 'G1' },
  { id: 'd2', type: 'DataAsset', name: '펀드 마스터', secretLevel: 'G2' },
  { id: 'd3', type: 'DataAsset', name: '임직원 개인정보', secretLevel: 'G3' },
  { id: 'e1', type: 'Employee', name: '홍인표', dept: 'AX팀' },
  { id: 'e2', type: 'Employee', name: '김지훈', dept: '준법팀' },
]

const MOCK_EDGES: GraphEdge[] = [
  { id: 'r1', from: 'a1', to: 'p1', label: 'BELONGS_TO' },
  { id: 'r2', from: 'a2', to: 'p2', label: 'BELONGS_TO' },
  { id: 'r3', from: 'a1', to: 'd1', label: 'CONSUMES' },
  { id: 'r4', from: 'a2', to: 'd2', label: 'CONSUMES' },
  { id: 'r5', from: 'e1', to: 'a1', label: 'MANAGES' },
  { id: 'r6', from: 'e2', to: 'p1', label: 'MANAGES' },
  { id: 'r7', from: 'd3', to: 'p1', label: 'REFERENCED_BY' },
]

// ─── 유틸 ───────────────────────────────────────────────────────────────────

function nodeColor(node: GraphNode): string {
  if (node.type === 'DataAsset' && node.secretLevel) {
    return SECRET_LEVEL_COLORS[node.secretLevel] ?? NODE_COLORS.DataAsset
  }
  return NODE_COLORS[node.type]
}

function buildElements(nodes: GraphNode[], edges: GraphEdge[]): ElementDefinition[] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const nodeEls: ElementDefinition[] = nodes.map((n) => ({
    data: {
      id: n.id,
      label: n.name,
      color: nodeColor(n),
      nodeData: n,
    },
  }))
  const edgeEls: ElementDefinition[] = edges
    .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
    .map((e) => ({
      data: {
        id: e.id,
        source: e.from,
        target: e.to,
        label: e.label,
      },
    }))
  return [...nodeEls, ...edgeEls]
}

// ─── API 호출 ─────────────────────────────────────────────────────────────

async function fetchNodes(): Promise<GraphNode[]> {
  try {
    const res = await fetch('/api/graph/nodes')
    if (!res.ok) throw new Error('nodes API error')
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return MOCK_NODES
    return data
  } catch {
    return MOCK_NODES
  }
}

async function fetchEdges(): Promise<GraphEdge[]> {
  try {
    const res = await fetch('/api/graph/edges')
    if (!res.ok) throw new Error('edges API error')
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return MOCK_EDGES
    return data
  } catch {
    return MOCK_EDGES
  }
}

async function fetchOverview(): Promise<OverviewData | null> {
  try {
    const res = await fetch('/api/graph/overview')
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function fetchExplore(nodeId: string, nodeType: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] } | null> {
  try {
    const res = await fetch(`/api/graph/explore?nodeId=${nodeId}&nodeType=${nodeType}&depth=1`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────

const NODE_TYPES = ['전체', 'Agent', 'Project', 'DataAsset', 'Employee'] as const
const SECRET_LEVELS = ['전체', 'G1', 'G2', 'G3'] as const

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [allNodes, setAllNodes] = useState<GraphNode[]>([])
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('전체')
  const [secretFilter, setSecretFilter] = useState<string>('전체')

  // ─── Cytoscape 초기화 ───────────────────────────────────────────────────

  const initCy = useCallback((elements: ElementDefinition[]) => {
    if (!containerRef.current) return

    if (cyRef.current) {
      cyRef.current.stop()
      const old = cyRef.current
      cyRef.current = null
      old.destroy()
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            label: 'data(label)',
            'font-size': '11px',
            color: '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            width: 60,
            height: 60,
            'text-wrap': 'wrap',
            'text-max-width': '55px',
            'font-weight': 'bold',
            'border-width': 2,
            'border-color': 'rgba(255,255,255,0.3)',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#fff',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '9px',
            color: '#64748b',
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#6366f1',
            'target-arrow-color': '#6366f1',
            color: '#4f46e5',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        randomize: false,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        edgeElasticity: () => 100,
        padding: 40,
      } as Parameters<Core['layout']>[0],
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    })

    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular
      setSelectedNode(node.data('nodeData') as GraphNode)
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelectedNode(null)
    })

    cy.on('dblclick', 'node', async (evt) => {
      const node = evt.target as NodeSingular
      const nd = node.data('nodeData') as GraphNode
      const result = await fetchExplore(nd.id, nd.type)
      if (result && (result.nodes.length > 0 || result.edges.length > 0)) {
        const els = buildElements(result.nodes, result.edges)
        initCy(els)
      }
    })

    cyRef.current = cy
  }, [])

  // ─── 필터 적용 ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (allNodes.length === 0) return

    let filtered = allNodes

    if (nodeTypeFilter !== '전체') {
      filtered = filtered.filter((n) => n.type === nodeTypeFilter)
    }

    if (secretFilter !== '전체') {
      filtered = filtered.filter(
        (n) => n.type !== 'DataAsset' || n.secretLevel === secretFilter
      )
    }

    const filteredIds = new Set(filtered.map((n) => n.id))
    const filteredEdges = allEdges.filter(
      (e) => filteredIds.has(e.from) && filteredIds.has(e.to)
    )

    initCy(buildElements(filtered, filteredEdges))
  }, [nodeTypeFilter, secretFilter, allNodes, allEdges, initCy])

  // ─── 초기 데이터 로드 ───────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const [nodes, edges, ov] = await Promise.all([
          fetchNodes(),
          fetchEdges(),
          fetchOverview(),
        ])

        if (!mounted) return
        setAllNodes(nodes)
        setAllEdges(edges)
        setOverview(ov)
        initCy(buildElements(nodes, edges))
      } catch {
        if (mounted) setError('데이터를 불러올 수 없습니다.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
      cyRef.current?.destroy()
    }
  }, [initCy])

  // ─── 선택 노드 연결 수 ──────────────────────────────────────────────────

  const connectedCount = selectedNode
    ? allEdges.filter(
        (e) => e.from === selectedNode.id || e.to === selectedNode.id
      ).length
    : 0

  // ─── 렌더 ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">지식 그래프</h1>
          {overview && (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              총 {overview.totalNodes}개 노드
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={nodeTypeFilter}
            onChange={(e) => setNodeTypeFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === '전체' ? '노드 타입: 전체' : t}
              </option>
            ))}
          </select>
          <select
            value={secretFilter}
            onChange={(e) => setSecretFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {SECRET_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l === '전체' ? '기밀등급: 전체' : `${l}급`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 px-6 py-2 bg-white border-b border-gray-100 shrink-0">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-[var(--muted)]">{type}</span>
          </div>
        ))}
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <span className="text-xs text-[var(--muted)]">DataAsset 기밀등급:</span>
        {Object.entries(SECRET_LEVEL_COLORS).map(([lvl, color]) => (
          <div key={lvl} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-[var(--muted)]">{lvl}</span>
          </div>
        ))}
      </div>

      {/* 바디 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 그래프 캔버스 */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[var(--muted)]">그래프 로딩 중...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-center">
                <p className="text-red-500 font-medium">{error}</p>
                <p className="text-sm text-[var(--muted)] mt-1">Mock 데이터로 시도합니다.</p>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* 사이드 패널 */}
        <div className="w-64 bg-white border-l border-gray-200 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">선택 노드 상세</h2>
          </div>

          {selectedNode ? (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* 노드 타입 배지 */}
              <div
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: nodeColor(selectedNode) }}
              >
                {selectedNode.type}
              </div>

              {/* 이름 */}
              <div>
                <p className="text-xs text-[var(--muted)] mb-0.5">이름</p>
                <p className="text-sm font-semibold text-gray-900">{selectedNode.name}</p>
              </div>

              {/* 타입별 추가 정보 */}
              {selectedNode.status && (
                <div>
                  <p className="text-xs text-[var(--muted)] mb-0.5">상태</p>
                  <p className="text-sm text-gray-700">{selectedNode.status}</p>
                </div>
              )}
              {selectedNode.lifecycleStage && (
                <div>
                  <p className="text-xs text-[var(--muted)] mb-0.5">라이프사이클</p>
                  <p className="text-sm text-gray-700">{selectedNode.lifecycleStage}</p>
                </div>
              )}
              {selectedNode.secretLevel && (
                <div>
                  <p className="text-xs text-[var(--muted)] mb-0.5">기밀등급</p>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white"
                    style={{ backgroundColor: SECRET_LEVEL_COLORS[selectedNode.secretLevel] }}
                  >
                    {selectedNode.secretLevel}
                  </span>
                </div>
              )}
              {selectedNode.dept && (
                <div>
                  <p className="text-xs text-[var(--muted)] mb-0.5">부서</p>
                  <p className="text-sm text-gray-700">{selectedNode.dept}</p>
                </div>
              )}

              {/* 연결 수 */}
              <div>
                <p className="text-xs text-[var(--muted)] mb-0.5">연결</p>
                <p className="text-sm text-gray-700">{connectedCount}개</p>
              </div>

              {/* 더블클릭 안내 */}
              <p className="text-xs text-[var(--muted)] italic">
                더블클릭으로 이 노드를 중심으로 탐색
              </p>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-[var(--muted)] text-center px-4">
                노드를 클릭하면<br />상세 정보가 표시됩니다
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
