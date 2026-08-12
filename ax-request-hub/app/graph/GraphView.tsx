'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import cytoscape, { type Core, type NodeSingular, type ElementDefinition } from 'cytoscape'
import { AlertTriangle, ChevronRight, Layers, RefreshCw, Search } from 'lucide-react'

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  type: 'Project' | 'Agent' | 'DataAsset'
  name: string
  status?: string
  secretLevel?: string
  dept?: string
  lifecycleStage?: string
}

interface GraphEdge {
  id: string
  from: string
  to: string
  label: string
}

interface ImpactSummary {
  projects: GraphNode[]
  dataAssets: GraphNode[]
  agents: GraphNode[]
}

// ─── 색상 ──────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  Project:   '#1E3560',
  Agent:     '#059669',
  DataAsset: '#B8956A',
}

const HIGHLIGHT_COLOR = '#EF4444'
const DIM_OPACITY = 0.15

// ─── API ───────────────────────────────────────────────────────────────────

function toGraphNode(n: { id: string; type: string; label: string; data?: Record<string, unknown> }): GraphNode {
  const d = n.data ?? {}
  return {
    id: n.id,
    type: n.type as GraphNode['type'],
    name: n.label,
    status: (d.status as string) ?? undefined,
    secretLevel: (d.classification as string) ?? (d.confidentialityLevel as string) ?? undefined,
    dept: (d.department as string) ?? (d.ownerDept as string) ?? undefined,
    lifecycleStage: (d.lifecycleStage as string) ?? undefined,
  }
}

async function loadFullGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const res = await fetch('/api/graph?mode=full')
  if (!res.ok) throw new Error('그래프 데이터를 불러올 수 없습니다.')
  const raw = await res.json()
  const nodes: GraphNode[] = (raw.nodes ?? []).map(toGraphNode)
  const edges: GraphEdge[] = (raw.edges ?? []).map((e: { id: string; source: string; target: string; label: string }) => ({
    id: e.id, from: e.source, to: e.target, label: e.label,
  }))
  return { nodes, edges }
}

async function loadImpact(nodeId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const res = await fetch(`/api/graph?mode=explore&nodeId=${nodeId}`)
  if (!res.ok) return { nodes: [], edges: [] }
  const raw = await res.json()
  return {
    nodes: (raw.nodes ?? []).map(toGraphNode),
    edges: (raw.edges ?? []).map((e: { id: string; source: string; target: string; label: string }) => ({
      id: e.id, from: e.source, to: e.target, label: e.label,
    })),
  }
}

async function loadOverview() {
  const res = await fetch('/api/graph?mode=overview')
  if (!res.ok) return null
  return res.json()
}

// ─── Cytoscape 엘리먼트 빌더 ───────────────────────────────────────────────

function buildElements(nodes: GraphNode[], edges: GraphEdge[]): ElementDefinition[] {
  const ids = new Set(nodes.map((n) => n.id))
  return [
    ...nodes.map((n) => ({
      data: { id: n.id, label: n.name, color: NODE_COLORS[n.type] ?? '#6B7280', nodeData: n },
    })),
    ...edges
      .filter((e) => ids.has(e.from) && ids.has(e.to))
      .map((e) => ({ data: { id: e.id, source: e.from, target: e.to, label: e.label } })),
  ]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CY_STYLE: any[] = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      label: 'data(label)',
      'font-size': '11px',
      color: '#fff',
      'text-valign': 'center',
      'text-halign': 'center',
      width: 56,
      height: 56,
      'text-wrap': 'wrap',
      'text-max-width': '52px',
      'font-weight': '600',
      'border-width': 2,
      'border-color': 'rgba(255,255,255,0.25)',
    },
  },
  {
    selector: 'node.highlighted',
    style: { 'border-width': 3, 'border-color': HIGHLIGHT_COLOR, 'background-color': HIGHLIGHT_COLOR },
  },
  {
    selector: 'node.dimmed',
    style: { opacity: DIM_OPACITY },
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
    selector: 'edge.highlighted',
    style: { 'line-color': HIGHLIGHT_COLOR, 'target-arrow-color': HIGHLIGHT_COLOR, width: 2.5 },
  },
  {
    selector: 'edge.dimmed',
    style: { opacity: DIM_OPACITY },
  },
]

// ─── 영향 범위 요약 ─────────────────────────────────────────────────────────

function buildImpactSummary(nodes: GraphNode[]): ImpactSummary {
  return {
    projects:   nodes.filter((n) => n.type === 'Project'),
    agents:     nodes.filter((n) => n.type === 'Agent'),
    dataAssets: nodes.filter((n) => n.type === 'DataAsset'),
  }
}

// ─── 상태 배지 ──────────────────────────────────────────────────────────────

const LIFECYCLE_LABEL: Record<string, string> = {
  DEVELOPING: '개발', GATE1: 'Gate1', GATE2: 'Gate2', GATE3: 'Gate3',
  ACTIVE: '운용중', DEGRADED: '성능저하', RETIRED: '폐기',
}
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  DEGRADED: 'bg-amber-100 text-amber-700',
  RETIRED: 'bg-red-100 text-red-700',
  submitted: 'bg-blue-100 text-blue-700',
  pilot: 'bg-violet-100 text-violet-700',
  production: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-500',
}

function StatusBadge({ value }: { value?: string }) {
  if (!value) return null
  const cls = STATUS_COLOR[value] ?? 'bg-gray-100 text-gray-600'
  const label = LIFECYCLE_LABEL[value] ?? value
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{label}</span>
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────

const NODE_TYPE_FILTERS = ['전체', 'Agent', 'Project', 'DataAsset'] as const

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef        = useRef<Core | null>(null)

  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [overview,     setOverview]     = useState<Record<string, unknown> | null>(null)
  const [allNodes,     setAllNodes]     = useState<GraphNode[]>([])
  const [allEdges,     setAllEdges]     = useState<GraphEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [impact,       setImpact]       = useState<ImpactSummary | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [typeFilter,   setTypeFilter]   = useState<string>('전체')
  const [search,       setSearch]       = useState('')

  // ─── Cytoscape 초기화 ─────────────────────────────────────────────────

  const initCy = useCallback((elements: ElementDefinition[]) => {
    if (!containerRef.current) return
    cyRef.current?.destroy()

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: CY_STYLE,
      layout: {
        name: 'cose',
        animate: false,
        randomize: false,
        nodeRepulsion: () => 10000,
        idealEdgeLength: () => 130,
        edgeElasticity: () => 100,
        padding: 40,
      } as Parameters<Core['layout']>[0],
      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    })

    cy.on('tap', 'node', (evt) => {
      const nd = (evt.target as NodeSingular).data('nodeData') as GraphNode
      setSelectedNode(nd)
    })
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null)
        setImpact(null)
        cy.elements().removeClass('highlighted dimmed')
      }
    })

    cyRef.current = cy
  }, [])

  // ─── 영향 범위 분석 ───────────────────────────────────────────────────

  const analyzeImpact = useCallback(async (node: GraphNode) => {
    if (!cyRef.current) return
    setImpactLoading(true)
    setImpact(null)

    const cy = cyRef.current
    cy.elements().removeClass('highlighted dimmed')

    const { nodes: impactNodes, edges: impactEdges } = await loadImpact(node.id)
    const impactIds = new Set([node.id, ...impactNodes.map((n) => n.id)])
    const impactEdgeIds = new Set(impactEdges.map((e) => e.id))

    cy.nodes().forEach((n) => {
      if (impactIds.has(n.id())) n.addClass('highlighted')
      else n.addClass('dimmed')
    })
    cy.edges().forEach((e) => {
      if (impactEdgeIds.has(e.id())) e.addClass('highlighted')
      else e.addClass('dimmed')
    })

    setImpact(buildImpactSummary(impactNodes))
    setImpactLoading(false)
  }, [])

  // ─── 필터 적용 ────────────────────────────────────────────────────────

  useEffect(() => {
    if (allNodes.length === 0) return
    let nodes = allNodes
    if (typeFilter !== '전체') nodes = nodes.filter((n) => n.type === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      nodes = nodes.filter((n) => n.name.toLowerCase().includes(q))
    }
    initCy(buildElements(nodes, allEdges))
    setSelectedNode(null)
    setImpact(null)
  }, [typeFilter, search, allNodes, allEdges, initCy])

  // ─── 초기 로드 ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ nodes, edges }, ov] = await Promise.all([loadFullGraph(), loadOverview()])
      setAllNodes(nodes)
      setAllEdges(edges)
      setOverview(ov)
      initCy(buildElements(nodes, edges))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [initCy])

  useEffect(() => {
    load()
    return () => { cyRef.current?.destroy() }
  }, [load])

  // ─── 통계 ─────────────────────────────────────────────────────────────

  const stats = overview
    ? { nodes: overview.nodes as Record<string, number> ?? {}, edges: overview.edges as Record<string, number> ?? {} }
    : null

  // ─── 렌더 ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#1E3560]">AI 영향도 분석</h1>
          {stats && (
            <p className="text-xs text-gray-500 mt-0.5">
              과제 {stats.nodes.Project ?? 0} · 에이전트 {stats.nodes.Agent ?? 0} · 데이터 {stats.nodes.DataAsset ?? 0}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="노드 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-[#1E3560]/30"
            />
          </div>

          {/* 타입 필터 */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1E3560]/30"
          >
            {NODE_TYPE_FILTERS.map((t) => (
              <option key={t} value={t}>{t === '전체' ? '타입: 전체' : t}</option>
            ))}
          </select>

          {/* 새로고침 */}
          <button
            onClick={load}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── 범례 ── */}
      <div className="flex items-center gap-5 px-6 py-2 bg-white border-b border-gray-100 shrink-0">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-500">{type}</span>
          </div>
        ))}
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: HIGHLIGHT_COLOR }} />
          <span className="text-xs text-gray-500">영향 범위</span>
        </div>
        <span className="ml-auto text-xs text-gray-400">클릭: 상세 · 더블클릭: 영향도 분석</span>
      </div>

      {/* ── 바디 ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* 그래프 캔버스 */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#1E3560] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-500">그래프 로딩 중...</span>
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center space-y-2">
                <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
                <p className="text-sm text-red-600 font-medium">{error}</p>
                <button onClick={load} className="text-xs text-[#1E3560] hover:underline">다시 시도</button>
              </div>
            </div>
          )}
          <div
            ref={containerRef}
            className="w-full h-full"
            onDoubleClick={() => {
              if (selectedNode) analyzeImpact(selectedNode)
            }}
          />
        </div>

        {/* 사이드 패널 */}
        <div className="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">

          {selectedNode ? (
            <>
              {/* 선택 노드 헤더 */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: NODE_COLORS[selectedNode.type] ?? '#6B7280' }}
                  >
                    {selectedNode.type}
                  </span>
                  <StatusBadge value={selectedNode.lifecycleStage ?? selectedNode.status} />
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-1.5 leading-tight">{selectedNode.name}</p>
                {selectedNode.dept && <p className="text-xs text-gray-400 mt-0.5">{selectedNode.dept}</p>}
                {selectedNode.secretLevel && (
                  <span className="inline-flex mt-1 items-center px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-[10px] font-bold text-amber-700">
                    {selectedNode.secretLevel}급
                  </span>
                )}
              </div>

              {/* 영향도 분석 버튼 */}
              <div className="px-4 py-3 border-b border-gray-100">
                <button
                  onClick={() => analyzeImpact(selectedNode)}
                  disabled={impactLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#1E3560] text-white text-sm font-medium hover:bg-[#1E3560]/90 disabled:opacity-60 transition"
                >
                  {impactLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Layers className="h-3.5 w-3.5" />
                      영향 범위 분석
                    </>
                  )}
                </button>
              </div>

              {/* 영향 범위 결과 */}
              {impact && (
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                  {impact.projects.length === 0 && impact.agents.length === 0 && impact.dataAssets.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400">
                      <p>연결된 노드가 없습니다.</p>
                      <p className="mt-1 text-[10px]">DataRequest assetId 연결 필요</p>
                    </div>
                  ) : (
                    <>
                      {/* 요약 카드 */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '과제', count: impact.projects.length, color: NODE_COLORS.Project },
                          { label: '에이전트', count: impact.agents.length, color: NODE_COLORS.Agent },
                          { label: '데이터', count: impact.dataAssets.length, color: NODE_COLORS.DataAsset },
                        ].map((s) => (
                          <div key={s.label} className="text-center p-2 rounded-lg bg-gray-50 border border-gray-100">
                            <p className="text-lg font-bold" style={{ color: s.color }}>{s.count}</p>
                            <p className="text-[10px] text-gray-400">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* 경고 (에이전트 선택 시) */}
                      {selectedNode.type === 'Agent' && (impact.projects.length > 0 || impact.dataAssets.length > 0) && (
                        <div className="flex gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-red-700 leading-snug">
                            이 에이전트 폐기 시 <strong>{impact.projects.length}개 과제</strong>와{' '}
                            <strong>{impact.dataAssets.length}개 데이터</strong>에 영향
                          </p>
                        </div>
                      )}

                      {/* 연결 과제 목록 */}
                      {impact.projects.length > 0 && (
                        <ImpactSection
                          title="연결 과제"
                          color={NODE_COLORS.Project}
                          items={impact.projects.map((p) => ({ name: p.name, sub: p.status }))}
                        />
                      )}

                      {/* 연결 에이전트 */}
                      {impact.agents.length > 0 && (
                        <ImpactSection
                          title="연결 에이전트"
                          color={NODE_COLORS.Agent}
                          items={impact.agents.map((a) => ({ name: a.name, sub: a.lifecycleStage }))}
                        />
                      )}

                      {/* 연결 데이터 자산 */}
                      {impact.dataAssets.length > 0 && (
                        <ImpactSection
                          title="참조 데이터 자산"
                          color={NODE_COLORS.DataAsset}
                          items={impact.dataAssets.map((d) => ({ name: d.name, sub: d.secretLevel ? `${d.secretLevel}급` : undefined }))}
                        />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* impact 미실행 시 안내 */}
              {!impact && !impactLoading && (
                <div className="flex-1 flex items-center justify-center px-4">
                  <p className="text-xs text-gray-400 text-center leading-relaxed">
                    위 버튼을 눌러<br />이 노드의 영향 범위를 분석하세요
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center px-4 gap-3">
              <Layers className="h-8 w-8 text-gray-200" />
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                그래프에서 노드를 클릭하면<br />상세 정보와 영향 범위를 확인할 수 있습니다
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ImpactSection 서브 컴포넌트 ──────────────────────────────────────────

function ImpactSection({
  title, color, items,
}: {
  title: string
  color: string
  items: { name: string; sub?: string }[]
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[11px] font-semibold text-gray-600">{title}</span>
        <span className="ml-auto text-[10px] text-gray-400">{items.length}개</span>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-50 border border-gray-100">
            <ChevronRight className="h-3 w-3 text-gray-300 shrink-0" />
            <span className="text-[11px] text-gray-700 flex-1 truncate">{item.name}</span>
            {item.sub && (
              <span className="text-[9px] text-gray-400 shrink-0">{item.sub}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
