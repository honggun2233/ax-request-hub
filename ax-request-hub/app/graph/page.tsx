'use client'

import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'

interface GraphNode {
  id: string
  type: 'Project' | 'Agent' | 'DataAsset' | 'Employee'
  label: string
  data: Record<string, unknown>
}

interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
}

const NODE_COLORS: Record<string, string> = {
  Project: '#4F46E5',
  Agent: '#059669',
  DataAsset: '#D97706',
  Employee: '#7C3AED',
}

const DATA_COLORS: Record<string, string> = {
  G1: '#6B7280',
  G2: '#D97706',
  G3: '#DC2626',
}

function nodeColor(node: GraphNode): string {
  if (node.type === 'DataAsset') {
    const cls = (node.data as { classification?: string }).classification ?? 'G1'
    return DATA_COLORS[cls] ?? NODE_COLORS.DataAsset
  }
  return NODE_COLORS[node.type] ?? '#6B7280'
}

export default function GraphPage() {
  const cyRef = useRef<HTMLDivElement>(null)
  const cyInstance = useRef<cytoscape.Core | null>(null)
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [filter, setFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<{ nodes: Record<string, number>; edges: Record<string, number> } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/graph?mode=overview').then((r) => r.json()),
      fetch('/api/graph?mode=full').then((r) => r.json()),
    ]).then(([ov, graph]) => {
      setOverview(ov)
      setLoading(false)
      if (!cyRef.current) return

      const elements: cytoscape.ElementDefinition[] = [
        ...(graph.nodes as GraphNode[]).map((n) => ({
          data: { id: n.id, label: n.label, type: n.type, color: nodeColor(n), raw: n },
        })),
        ...(graph.edges as GraphEdge[]).map((e) => ({
          data: { id: e.id, source: e.source, target: e.target, label: e.label },
        })),
      ]

      cyInstance.current = cytoscape({
        container: cyRef.current,
        elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'data(color)',
              label: 'data(label)',
              'text-valign': 'bottom',
              'text-halign': 'center',
              'font-size': '11px',
              color: '#111',
              'text-max-width': '100px',
              'text-wrap': 'wrap',
              width: 40,
              height: 40,
            },
          },
          {
            selector: 'edge',
            style: {
              width: 2,
              'line-color': '#CBD5E1',
              'target-arrow-color': '#CBD5E1',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              label: 'data(label)',
              'font-size': '9px',
              color: '#94A3B8',
            },
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 3,
              'border-color': '#F59E0B',
            },
          },
        ],
        layout: { name: 'cose', animate: false, padding: 40 } as cytoscape.LayoutOptions,
      })

      cyInstance.current.on('tap', 'node', (evt) => {
        const raw = evt.target.data('raw') as GraphNode
        setSelected(raw)
      })

      cyInstance.current.on('tap', (evt) => {
        if (evt.target === cyInstance.current) setSelected(null)
      })
    })

    return () => cyInstance.current?.destroy()
  }, [])

  useEffect(() => {
    if (!cyInstance.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cy = cyInstance.current as any
    if (filter === 'ALL') {
      cy.nodes().show()
      cy.edges().show()
    } else {
      cy.nodes().hide()
      cy.edges().hide()
      const visible = cy.nodes(`[type = "${filter}"]`)
      visible.show()
      visible.connectedEdges().show()
      visible.connectedEdges().connectedNodes().show()
    }
  }, [filter])

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="border-b bg-white px-6 py-3 flex items-center gap-4 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800">지식 그래프</h1>
        {overview && (
          <div className="flex gap-3 text-sm text-gray-500">
            <span>과제 <strong className="text-indigo-600">{overview.nodes.Project ?? 0}</strong></span>
            <span>에이전트 <strong className="text-emerald-600">{overview.nodes.Agent ?? 0}</strong></span>
            <span>데이터 <strong className="text-amber-600">{overview.nodes.DataAsset ?? 0}</strong></span>
          </div>
        )}
        {/* 필터 */}
        <div className="ml-auto flex gap-2">
          {['ALL', 'Project', 'Agent', 'DataAsset'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded px-3 py-1 text-sm font-medium transition ${
                filter === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'ALL' ? '전체' : t === 'Project' ? '과제' : t === 'Agent' ? '에이전트' : '데이터'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 그래프 캔버스 */}
        <div className="relative flex-1">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              그래프 로딩 중...
            </div>
          )}
          <div ref={cyRef} className="h-full w-full" />

          {/* 범례 */}
          <div className="absolute bottom-4 left-4 rounded-lg border bg-white p-3 text-xs shadow">
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2 mb-1">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
                <span className="text-gray-600">{type === 'Project' ? '과제' : type === 'Agent' ? '에이전트' : type === 'DataAsset' ? '데이터 자산' : '임직원'}</span>
              </div>
            ))}
            <div className="mt-1 pt-1 border-t text-gray-400">
              <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-orange-500" /> G2 데이터</div>
              <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-red-600" /> G3 기밀</div>
            </div>
          </div>
        </div>

        {/* 사이드 패널 */}
        {selected && (
          <div className="w-72 border-l bg-white p-4 overflow-y-auto shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="inline-block h-4 w-4 rounded-full"
                style={{ background: NODE_COLORS[selected.type] ?? '#6B7280' }}
              />
              <span className="text-xs text-gray-400 uppercase">{selected.type}</span>
            </div>
            <h2 className="text-base font-semibold text-gray-800 mb-3">{selected.label}</h2>
            <dl className="space-y-2 text-sm">
              {Object.entries(selected.data).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-gray-400 text-xs">{k}</dt>
                  <dd className="text-gray-700 truncate">{String(v ?? '-')}</dd>
                </div>
              ))}
            </dl>
            {selected.type === 'Project' && (
              <a
                href={`/status/${(selected.data as { id: string }).id}`}
                className="mt-4 block rounded bg-indigo-600 px-3 py-2 text-center text-sm text-white hover:bg-indigo-700"
              >
                과제 상세 보기 →
              </a>
            )}
            {selected.type === 'Agent' && (
              <a
                href={`/registry`}
                className="mt-4 block rounded bg-emerald-600 px-3 py-2 text-center text-sm text-white hover:bg-emerald-700"
              >
                레지스트리에서 보기 →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
