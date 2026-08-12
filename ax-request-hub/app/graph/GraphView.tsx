'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const BDR = '#E4E9F2'
const TEXT = '#18243D'
const MUTED = '#8898BB'
const DIM = '#BEC8DC'
const SB = '#F7F9FC'
const ACCENT = '#4A6FA5'

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#3B82F6',
}

const TYPE_OPTIONS = [
  { value: 'agent',     label: '에이전트' },
  { value: 'project',   label: 'AI 활용 (과제)' },
]

interface ImpactResult {
  severity: string
  summary: string
  affected: {
    projects: Array<{ id: string; name: string; connectionType: string }>
    employees: Array<{ id: string; name: string; role: string }>
    agents: Array<{ id: string; name: string; connectionType: string }>
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const colorMap: Record<string, { bg: string; text: string; label: string }> = {
    critical: { bg: 'rgba(239,68,68,.10)', text: '#B91C1C', label: '심각' },
    high:     { bg: 'rgba(249,115,22,.10)', text: '#C2410C', label: '높음' },
    medium:   { bg: 'rgba(245,158,11,.10)', text: '#B45309', label: '중간' },
    low:      { bg: 'rgba(59,130,246,.10)', text: '#1D4ED8', label: '낮음' },
  }
  const s = colorMap[severity] ?? colorMap.low
  return (
    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

export default function GraphView() {
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<string>('agent')
  const [selectedId, setSelectedId] = useState<string>('')
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [impact, setImpact] = useState<ImpactResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'graph'>('list')
  const [analyzed, setAnalyzed] = useState(false)

  useEffect(() => {
    setSelectedId('')
    setItems([])
    setImpact(null)
    setAnalyzed(false)
    setLoadingItems(true)

    const url = selectedType === 'agent' ? '/api/registry' : '/api/projects'
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.agents ?? data.projects ?? [])
        setItems(list.map((x: any) => ({
          id: x.id,
          name: x.agentName ?? x.name ?? x.id,
        })))
        setLoadingItems(false)
      })
      .catch(() => setLoadingItems(false))
  }, [selectedType])

  const analyze = async () => {
    if (!selectedId) return
    setAnalyzing(true)
    setImpact(null)
    setAnalyzed(false)
    try {
      const res = await fetch(`/api/graph/impact?type=${selectedType}&id=${selectedId}`)
      const data = await res.json()
      setImpact(data)
      setAnalyzed(true)
      setActiveTab('list')
    } finally {
      setAnalyzing(false)
    }
  }

  const selectedItem = items.find(x => x.id === selectedId)

  const inputSt: React.CSSProperties = {
    width: '100%', background: '#FFFFFF', border: `1px solid ${BDR}`,
    borderRadius: 8, padding: '10px 12px', fontSize: 13, color: TEXT,
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: SB, padding: '32px 24px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: TEXT, margin: 0 }}>영향도 분석</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>
            에이전트 또는 과제를 선택하면, 폐기·변경 시 영향받는 항목을 분석합니다.
          </p>
        </div>

        {/* 질문 선택 UI */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: `1px solid ${BDR}`, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* 타입 선택 */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 8 }}>
                분석 대상 타입
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {TYPE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setSelectedType(opt.value)} style={{
                    flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: selectedType === opt.value ? ACCENT : '#FFFFFF',
                    color: selectedType === opt.value ? '#FFFFFF' : MUTED,
                    border: `1px solid ${selectedType === opt.value ? ACCENT : BDR}`,
                    transition: 'all .15s',
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 대상 선택 */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 8 }}>
                대상 선택
              </label>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                disabled={loadingItems}
                style={inputSt}
              >
                <option value="">{loadingItems ? '로딩 중...' : '선택하세요'}</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>

            {/* 분석 버튼 */}
            <button
              onClick={analyze}
              disabled={!selectedId || analyzing}
              style={{
                padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: selectedId ? 'pointer' : 'not-allowed',
                background: selectedId && !analyzing ? ACCENT : 'rgba(74,111,165,.3)',
                color: '#FFFFFF', border: 'none', transition: 'background .15s',
              }}
            >
              {analyzing ? '분석 중...' : '영향도 분석 시작'}
            </button>
          </div>
        </div>

        {/* 결과 */}
        {analyzed && impact && (
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: `1px solid ${BDR}`, overflow: 'hidden' }}>

            {/* 결과 헤더 */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BDR}`, background: SB }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SeverityBadge severity={impact.severity} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: 0 }}>
                    {selectedItem?.name ?? '선택한 항목'}
                  </p>
                  <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{impact.summary}</p>
                </div>
              </div>
            </div>

            {/* 탭 */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${BDR}` }}>
              {(['list', 'graph'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  flex: 1, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab ? `2px solid ${ACCENT}` : '2px solid transparent',
                  color: activeTab === tab ? ACCENT : MUTED,
                }}>
                  {tab === 'list' ? '목록' : '그래프'}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            <div style={{ padding: 20 }}>
              {activeTab === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* 영향받는 과제 */}
                  {impact.affected.projects.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                        영향받는 AI 활용 ({impact.affected.projects.length}건)
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {impact.affected.projects.map(p => (
                          <div
                            key={p.id}
                            onClick={() => router.push('/projects')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: SB, borderRadius: 8, border: `1px solid ${BDR}`, cursor: 'pointer', transition: 'border-color .15s' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = ACCENT)}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = BDR)}
                          >
                            <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{p.name}</span>
                            <span style={{ fontSize: 11, color: DIM }}>{p.connectionType}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 영향받는 에이전트 */}
                  {impact.affected.agents && impact.affected.agents.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                        의존 에이전트 ({impact.affected.agents.length}개)
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {impact.affected.agents.map(a => (
                          <div
                            key={a.id}
                            onClick={() => router.push('/registry')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: SB, borderRadius: 8, border: `1px solid ${BDR}`, cursor: 'pointer', transition: 'border-color .15s' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = ACCENT)}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = BDR)}
                          >
                            <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{a.name}</span>
                            <span style={{ fontSize: 11, color: DIM }}>{a.connectionType}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 통보 대상 */}
                  {impact.affected.employees.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                        통보 대상 ({impact.affected.employees.length}명)
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {impact.affected.employees.map(e => (
                          <div key={e.id} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, background: SB, border: `1px solid ${BDR}`, color: MUTED }}>
                            {e.name} <span style={{ color: DIM }}>· {e.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {impact.affected.projects.length === 0 &&
                    impact.affected.employees.length === 0 &&
                    (!impact.affected.agents || impact.affected.agents.length === 0) && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#059669', background: 'rgba(16,185,129,.06)', borderRadius: 8, border: '1px solid rgba(16,185,129,.2)', fontSize: 13 }}>
                      ✓ 영향받는 항목이 없습니다. 안전하게 변경 가능합니다.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'graph' && (
                <ImpactSubgraph impact={impact} severity={impact.severity} centerName={selectedItem?.name ?? ''} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ImpactSubgraph({ impact, severity, centerName }: { impact: ImpactResult; severity: string; centerName: string }) {
  const allNodes = [
    { id: 'center', name: centerName, type: 'center' },
    ...impact.affected.projects.map(p => ({ id: `proj-${p.id}`, name: p.name, type: 'project' })),
    ...(impact.affected.agents ?? []).map(a => ({ id: `agent-${a.id}`, name: a.name, type: 'agent' })),
    ...impact.affected.employees.map(e => ({ id: `emp-${e.id}`, name: e.name, type: 'employee' })),
  ]

  const centerColor = SEVERITY_COLOR[severity] ?? '#3B82F6'
  const typeColors: Record<string, string> = {
    center:   centerColor,
    project:  '#4A6FA5',
    agent:    '#7C3AED',
    employee: '#059669',
  }

  if (allNodes.length <= 1) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: MUTED, fontSize: 13 }}>
        영향받는 항목이 없어 그래프를 표시할 수 없습니다.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 700 ${Math.max(200, allNodes.length * 60)}`} style={{ minHeight: 200 }}>
        {allNodes.slice(1).map((node, i) => {
          const cx = 500
          const cy = 60 + i * 60
          const color = typeColors[node.type] ?? '#8898BB'
          return (
            <g key={node.id}>
              <line x1={200} y1={Math.max(200, allNodes.length * 60) / 2} x2={cx} y2={cy}
                stroke={BDR} strokeWidth={1.5} />
              <circle cx={cx} cy={cy} r={20} fill={`${color}22`} stroke={color} strokeWidth={1.5} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fill={color} fontWeight={600}>
                {node.type === 'project' ? '과제' : node.type === 'agent' ? '에이전트' : '직원'}
              </text>
              <text x={cx + 28} y={cy + 4} fontSize={11} fill={TEXT}>{node.name.length > 14 ? node.name.slice(0, 14) + '…' : node.name}</text>
            </g>
          )
        })}
        {/* 중심 노드 */}
        <circle cx={200} cy={Math.max(200, allNodes.length * 60) / 2} r={32} fill={`${centerColor}22`} stroke={centerColor} strokeWidth={2} />
        <text x={200} y={Math.max(200, allNodes.length * 60) / 2 + 4} textAnchor="middle" fontSize={11} fill={centerColor} fontWeight={700}>
          {centerName.length > 8 ? centerName.slice(0, 8) + '…' : centerName}
        </text>
      </svg>
      <p style={{ fontSize: 10, color: DIM, textAlign: 'center', marginTop: 8 }}>
        영향 범위 서브그래프 — 연결된 항목만 표시
      </p>
    </div>
  )
}
