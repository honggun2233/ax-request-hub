'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import RetireConfirmModal from './components/RetireConfirmModal'

const CARD   = '#FFFFFF'
const CARD2  = '#F7F9FC'
const BDR    = '#E4E9F2'
const ACCENT = '#4A6FA5'
const TEXT   = '#18243D'
const MUTED  = '#8898BB'
const DIM    = '#BEC8DC'
const SB     = '#F7F9FC'

const LIFECYCLE_STAGES = [
  { key: 'DEVELOPING', label: '개발중',         color: 'rgba(136,152,187,.12)', text: '#5A6E8C',  border: 'rgba(136,152,187,.35)' },
  { key: 'GATE1',      label: 'Gate1 QA',       color: 'rgba(74,111,165,.10)',  text: '#4A6FA5',  border: 'rgba(74,111,165,.35)' },
  { key: 'GATE2',      label: 'Gate2 도메인',   color: 'rgba(217,119,6,.10)',   text: '#B45309',  border: 'rgba(217,119,6,.35)' },
  { key: 'GATE3',      label: 'Gate3 스트레스', color: 'rgba(109,40,217,.10)',  text: '#7C3AED',  border: 'rgba(109,40,217,.30)' },
  { key: 'ACTIVE',     label: '운영중',          color: 'rgba(5,150,105,.10)',   text: '#059669',  border: 'rgba(5,150,105,.35)' },
  { key: 'DEGRADED',   label: '성능저하',        color: 'rgba(185,64,64,.10)',   text: '#B94040',  border: 'rgba(185,64,64,.35)' },
  { key: 'RETIRED',    label: '폐기',            color: 'rgba(190,200,220,.15)', text: '#8898BB',  border: '#E4E9F2' },
]

const STAGE_ACTIONS: Record<string, string> = {
  DEVELOPING: '개발 중. Gate1 진입 전 단계 — 기능 테스트 80% 이상, 데이터 플로우 다이어그램 작성 후 Gate1 신청.',
  GATE1:      'QA 검증 단계 — fallback율 ≤ 30%, 핵심 기능 정상 반환 확인 중.',
  GATE2:      '도메인 리뷰 단계 — 담당 부서의 업무 적합성 검토 및 운용역/현업 신뢰점수 태깅 필요.',
  GATE3:      'QA 스트레스 테스트 단계 — 데이터 없음/이상값 처리 및 장시간 안정성 확인 중.',
  ACTIVE:     '정상 운영 중. 주간 KPI 및 fallback율 모니터링.',
  DEGRADED:   '⚠ 성능 저하 감지 — 즉시 점검 필요. fallback율 증가 또는 정확도 하락.',
  RETIRED:    '폐기 완료. 아카이브에서 이력 확인 가능.',
}

const NEXT_STAGE: Record<string, string> = {
  DEVELOPING: 'GATE1', GATE1: 'GATE2', GATE2: 'GATE3', GATE3: 'ACTIVE', DEGRADED: 'RETIRED',
}

const ROLE_LABEL: Record<string, string> = {
  PRIMARY: '주에이전트', SUPPORTING: '보조', EXPERIMENTAL: '실험적',
}

function StageBadge({ stage }: { stage: string }) {
  const s = LIFECYCLE_STAGES.find(x => x.key === stage)
  if (!s) return null
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap',
      background: s.color, color: s.text, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  )
}

function GateBar({ g1, g2, g3 }: { g1: boolean; g2: boolean; g3: boolean }) {
  const dot = (passed: boolean, label: string) => (
    <span key={label} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
      background: passed ? 'rgba(5,150,105,.10)' : CARD2,
      color: passed ? '#059669' : DIM, border: `1px solid ${passed ? 'rgba(5,150,105,.3)' : BDR}` }}>
      {passed ? '✓' : '–'} {label}
    </span>
  )
  return <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>{dot(g1, 'G1')}{dot(g2, 'G2')}{dot(g3, 'G3')}</div>
}

function FallbackBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  const color = pct <= 30 ? '#10B981' : pct <= 70 ? '#F59E0B' : '#EF4444'
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MUTED, marginBottom: 4 }}>
        <span>Fallback율</span>
        <span style={{ color: pct > 70 ? '#B94040' : MUTED, fontWeight: pct > 70 ? 600 : 400 }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: '#E4E9F2', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', background: '#FFFFFF', border: `1px solid ${BDR}`, borderRadius: 6,
  padding: '7px 10px', fontSize: 13, color: TEXT, outline: 'none', boxSizing: 'border-box',
}

// ── 슬라이드오버 ───────────────────────────────────────────────
function SlideOver({ agent, allProjects, onClose, onStageChange }: {
  agent: any; allProjects: any[]; onClose: () => void; onStageChange: () => void
}) {
  const { data: session } = useSession()
  const isAxTeam = (session?.user as any)?.role === 'AX_TEAM'

  const [trustScore, setTrustScore]   = useState<number>(agent.operatorTrustScore ?? 3)
  const [comment, setComment]         = useState<string>(agent.operatorComment ?? '')
  const [saving, setSaving]           = useState(false)
  const [stageError, setStageError]   = useState<string | null>(null)
  const [linkSaving, setLinkSaving]   = useState(false)
  const [linkError, setLinkError]     = useState<string | null>(null)
  const [addingProject, setAddingProject] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedRole, setSelectedRole] = useState('PRIMARY')
  const [dataWarning, setDataWarning] = useState<{ pendingCount: number; totalCount: number } | null>(null)
  const [showRetireModal, setShowRetireModal] = useState(false)

  const linkedIds = new Set((agent.projects ?? []).map((p: any) => p.projectId))
  const unlinkable = allProjects.filter(p => !linkedIds.has(p.id))

  const advanceStage = async (newStage: string) => {
    setSaving(true); setStageError(null); setDataWarning(null)
    const res = await fetch('/api/registry', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: agent.id, lifecycleStage: newStage, operatorTrustScore: trustScore, operatorComment: comment }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '요청 실패' }))
      setStageError(err.error ?? '단계 변경에 실패했습니다.')
      setSaving(false)
      return
    }
    const json = await res.json()
    setSaving(false)
    if (json.dataWarning) { setDataWarning(json.dataWarning); onStageChange(); return }
    onStageChange(); onClose()
  }

  const addLink = async () => {
    if (!selectedProjectId) return
    setLinkSaving(true); setLinkError(null)
    const res = await fetch('/api/registry/links', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, projectId: selectedProjectId, role: selectedRole }),
    })
    setLinkSaving(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '연결 실패' }))
      setLinkError(err.error ?? '프로젝트 연결에 실패했습니다.')
      return
    }
    setAddingProject(false); setSelectedProjectId('')
    onStageChange()
  }

  const removeLink = async (projectId: string) => {
    const res = await fetch('/api/registry/links', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, projectId }),
    })
    if (!res.ok) return
    onStageChange()
  }

  const nextStage = NEXT_STAGE[agent.lifecycleStage]

  const rowSt: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 12,
    borderBottom: `1px solid ${BDR}`,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(30,53,96,.35)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ width: 440, background: CARD, borderLeft: `1px solid ${BDR}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BDR}`, background: SB }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: TEXT, margin: 0 }}>{agent.agentName}</h2>
            <p style={{ fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>{agent.purpose}</p>
            <div style={{ marginTop: 8 }}><StageBadge stage={agent.lifecycleStage} /></div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: DIM, fontSize: 20, cursor: 'pointer', marginLeft: 12 }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>

          {/* 소속 프로젝트 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>소속 AI 활용</p>
              {isAxTeam && (
                <button onClick={() => setAddingProject(!addingProject)}
                  style={{ fontSize: 11, color: '#4A6FA5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {addingProject ? '취소' : '+ 연결'}
                </button>
              )}
            </div>
            {(agent.projects ?? []).length === 0 && !addingProject && (
              <p style={{ fontSize: 11, color: DIM, fontStyle: 'italic' }}>연결된 AI 활용 없음</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(agent.projects ?? []).map((link: any) => (
                <div key={link.projectId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 6, background: CARD2, border: `1px solid ${BDR}`, fontSize: 12 }}>
                  <div>
                    <span style={{ color: TEXT, fontWeight: 500 }}>{link.project?.name ?? link.projectId}</span>
                    <span style={{ marginLeft: 8, color: DIM, fontSize: 10 }}>{ROLE_LABEL[link.role] ?? link.role}</span>
                  </div>
                  {isAxTeam && (
                    <button onClick={() => removeLink(link.projectId)}
                      style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 12 }}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {linkError && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#B94040', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 6, padding: '6px 10px' }}>
                {linkError}
              </div>
            )}
            {addingProject && isAxTeam && (
              <div style={{ marginTop: 8, padding: 12, background: 'rgba(59,130,246,.08)', border: `1px solid rgba(59,130,246,.2)`, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} style={inputSt}>
                  <option value="">프로젝트 선택...</option>
                  {unlinkable.map(p => <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>)}
                </select>
                <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} style={inputSt}>
                  <option value="PRIMARY">주에이전트 (PRIMARY)</option>
                  <option value="SUPPORTING">보조 (SUPPORTING)</option>
                  <option value="EXPERIMENTAL">실험적 (EXPERIMENTAL)</option>
                </select>
                <button onClick={addLink} disabled={!selectedProjectId || linkSaving} style={{
                  padding: '8px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  {linkSaving ? '저장 중...' : '연결 추가'}
                </button>
              </div>
            )}
          </div>

          {/* Gate 진행도 */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Gate 진행도</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Gate1 — QA 기능 검증',  passed: agent.gate1Passed, at: agent.gate1PassedAt, criteria: 'fallback율 ≤ 30%, AgentSignal 정상' },
                { label: 'Gate2 — 도메인 검증',   passed: agent.gate2Passed, at: agent.gate2PassedAt, criteria: '30일 정확도 ≥ 55%, 신뢰점수 ≥ 3' },
                { label: 'Gate3 — 스트레스 검증', passed: agent.gate3Passed, at: agent.gate3PassedAt, criteria: '이상값/데이터없음 크래시 0' },
              ].map(g => (
                <div key={g.label} style={{ borderRadius: 6, padding: '8px 12px', background: g.passed ? 'rgba(16,185,129,.08)' : CARD2, border: `1px solid ${g.passed ? 'rgba(16,185,129,.25)' : BDR}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: g.passed ? '#059669' : DIM }}>{g.passed ? '✓' : '○'}</span>
                    <span style={{ fontSize: 12, color: g.passed ? '#065F46' : MUTED, flex: 1 }}>{g.label}</span>
                    {g.at && <span style={{ fontSize: 10, color: DIM }}>{new Date(g.at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>}
                  </div>
                  <p style={{ fontSize: 10, color: DIM, marginTop: 3, marginLeft: 20 }}>{g.criteria}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 주요 지표 */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>주요 지표</p>
            <div style={{ background: SB, borderRadius: 6, border: `1px solid ${BDR}`, overflow: 'hidden' }}>
              {[
                { label: '데이터소스',    value: agent.dataSource },
                { label: '실데이터 연결', value: agent.realDataConnected ? '연결됨' : 'Mock 사용', ok: agent.realDataConnected },
                { label: 'Fallback율',    value: `${Math.round(agent.fallbackRate * 100)}%`, warn: agent.fallbackRate > 0.7 },
                { label: '30일 정확도',  value: agent.sam30dAccuracy != null ? `${Math.round(agent.sam30dAccuracy * 100)}%` : '측정 중' },
                { label: '최근 Score',    value: agent.scores?.[0]?.score?.toFixed(1) ?? '없음' },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ ...rowSt, borderBottom: i < arr.length - 1 ? `1px solid ${BDR}` : 'none' }}>
                  <span style={{ color: MUTED }}>{row.label}</span>
                  <span style={{ fontWeight: 500, color: 'warn' in row && row.warn ? '#B94040' : 'ok' in row ? (row.ok ? '#059669' : MUTED) : TEXT }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase C — Gate 2 데이터 경고 */}
          {dataWarning && (
            <div style={{ borderRadius: 6, border: '1px solid rgba(245,158,11,.35)', background: 'rgba(245,158,11,.08)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#F59E0B', marginTop: 1 }}>⚠</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#92400E', margin: 0 }}>데이터 미승인 경고</p>
                  <p style={{ fontSize: 11, color: '#78350F', marginTop: 4, lineHeight: 1.5 }}>
                    연결된 AI 활용 신청의 데이터 요건 {dataWarning.totalCount}건 중 <strong>{dataWarning.pendingCount}건이 미승인</strong> 상태입니다.
                    Gate2는 진행됐지만, 데이터 승인 전까지 실데이터를 사용할 수 없습니다.
                  </p>
                  <p style={{ fontSize: 10, color: '#92400E', marginTop: 6 }}>DATA_PLATFORM팀 검토 완료 후 연결됩니다.</p>
                </div>
              </div>
            </div>
          )}

          {/* Gate2 운용역 리뷰 — AX_TEAM 전용 */}
          {agent.lifecycleStage === 'GATE2' && isAxTeam && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>운용역 리뷰 태깅</p>
              <div style={{ background: 'rgba(249,115,22,.06)', border: '1px solid rgba(249,115,22,.25)', borderRadius: 6, padding: '14px' }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: MUTED, display: 'block', marginBottom: 6 }}>신뢰점수 (1=불신 / 5=매우신뢰)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setTrustScore(n)} style={{
                        width: 36, height: 36, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        background: trustScore === n ? '#B8956A' : '#FFFFFF',
                        color: trustScore === n ? '#fff' : MUTED,
                        border: `1px solid ${trustScore === n ? '#B8956A' : BDR}`,
                      }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: MUTED, display: 'block', marginBottom: 4 }}>코멘트 (선택)</label>
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="도메인 관점 의견을 남겨주세요" rows={3}
                    style={{ ...inputSt, resize: 'none' }} />
                </div>
              </div>
            </div>
          )}

          {agent.notes && (
            <div style={{ fontSize: 11, color: MUTED, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 6, padding: '10px 12px', lineHeight: 1.5 }}>
              📝 {agent.notes}
            </div>
          )}
        </div>

        {/* 액션 버튼 — AX_TEAM 전용 */}
        {isAxTeam && (nextStage || agent.lifecycleStage === 'GATE3' || agent.lifecycleStage === 'DEGRADED') && (
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${BDR}`, background: SB, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stageError && (
              <div style={{ fontSize: 11, color: '#B94040', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 6, padding: '6px 10px' }}>
                {stageError}
              </div>
            )}
            {agent.lifecycleStage === 'DEGRADED' && (
              <button disabled={saving} onClick={() => advanceStage('ACTIVE')} style={{
                padding: '10px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {saving ? '저장 중...' : '✓ ACTIVE 복구 (성능저하 해소)'}
              </button>
            )}
            {nextStage && nextStage !== 'ACTIVE' && agent.lifecycleStage !== 'DEGRADED' && (
              <button disabled={saving} onClick={() => advanceStage(nextStage)} style={{
                padding: '10px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {saving ? '저장 중...' : `→ ${LIFECYCLE_STAGES.find(s => s.key === nextStage)?.label} 진행`}
              </button>
            )}
            {agent.lifecycleStage === 'GATE3' && (
              <button disabled={saving} onClick={() => advanceStage('ACTIVE')} style={{
                padding: '10px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {saving ? '저장 중...' : '✓ ACTIVE 전환 (Gate3 통과)'}
              </button>
            )}
            {!['ACTIVE', 'RETIRED'].includes(agent.lifecycleStage) && (
              <button onClick={() => setShowRetireModal(true)} style={{
                padding: '8px', background: 'none', border: '1px solid rgba(239,68,68,.35)', color: '#B94040', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              }}>
                폐기 처리 (RETIRED)
              </button>
            )}
          </div>
        )}
        {showRetireModal && (
          <RetireConfirmModal
            agentId={agent.id}
            agentName={agent.agentName}
            onClose={() => setShowRetireModal(false)}
            onConfirm={() => { setShowRetireModal(false); onStageChange(); onClose() }}
          />
        )}
      </div>
    </div>
  )
}

// ── 에이전트 등록 모달 ──────────────────────────────────────────
function RegisterModal({ approvedProjects, defaultProjectId, onClose, onCreated }: {
  approvedProjects: any[]; defaultProjectId: string; onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({
    agentName: '', agentKey: '', purpose: '', dataSource: '',
    projectId: defaultProjectId, lifecycleStage: 'DEVELOPING',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.projectId) { setError('승인된 AI 활용을 선택하세요.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/registry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? '등록 오류') }
      onCreated(); onClose()
    } catch (e: any) { setError(e.message); setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: CARD, border: `1px solid ${BDR}`, borderRadius: 12, width: '100%', maxWidth: 460, margin: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${BDR}`, background: SB }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0 }}>에이전트 등록</h2>
            <p style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>승인된 AI 활용과 연결 필수 (Q2)</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: DIM, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              연결 AI 활용 <span style={{ color: '#B94040' }}>*</span>
              <span style={{ fontWeight: 400, color: DIM, marginLeft: 6, textTransform: 'none' }}>(승인된 것만 표시)</span>
            </label>
            {approvedProjects.length === 0 ? (
              <div style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#92400E' }}>
                승인된 AI 활용이 없습니다.{' '}
                <Link href="/me/projects" style={{ color: '#4A6FA5', fontWeight: 600 }}>내 AI 활용</Link>에서 먼저 신청하세요.
              </div>
            ) : (
              <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })} required style={inputSt}>
                <option value="">-- 선택 --</option>
                {approvedProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.status === 'pilot' ? '파일럿승인' : '운영중'}] {p.title} · {p.department}
                  </option>
                ))}
              </select>
            )}
          </div>

          {[
            { key: 'agentName', label: '에이전트 이름', placeholder: '예: ETF-Rebalance-Agent', required: true },
            { key: 'agentKey',  label: '에이전트 키 (영문소문자·하이픈)', placeholder: 'etf-rebalance-agent', required: true },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                {f.label}{f.required && <span style={{ color: '#B94040', marginLeft: 3 }}>*</span>}
              </label>
              <input type="text" required={f.required} value={(form as any)[f.key]}
                onChange={e => {
                  const v = f.key === 'agentKey' ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') : e.target.value
                  setForm({ ...form, [f.key]: v })
                }}
                placeholder={f.placeholder} style={inputSt} />
            </div>
          ))}

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              목적·기능 설명 <span style={{ color: '#B94040' }}>*</span>
            </label>
            <textarea required value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}
              rows={2} placeholder="에이전트가 하는 일을 1~2문장으로 설명하세요"
              style={{ ...inputSt, resize: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>데이터 소스</label>
            <input type="text" value={form.dataSource} onChange={e => setForm({ ...form, dataSource: e.target.value })}
              placeholder="예: KRX API, 내부 DB, Mock" style={inputSt} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>시작 단계</label>
            <select value={form.lifecycleStage} onChange={e => setForm({ ...form, lifecycleStage: e.target.value })} style={inputSt}>
              <option value="DEVELOPING">DEVELOPING (개발중)</option>
              <option value="GATE1">GATE1 (QA 검증)</option>
            </select>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#B94040' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '9px', background: 'none', border: `1px solid ${BDR}`, color: MUTED, borderRadius: 8, fontSize: 13, cursor: 'pointer',
            }}>취소</button>
            <button type="submit" disabled={saving || approvedProjects.length === 0} style={{
              flex: 1, padding: '9px', background: saving || approvedProjects.length === 0 ? CARD2 : ACCENT,
              border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              {saving ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 프로젝트 뷰 ──────────────────────────────────────────────
function ProjectView({ projects, onAgentClick }: { projects: any[]; onAgentClick: (agent: any) => void }) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(projects.map(p => p.key)))
  const toggle = (key: string) => setExpandedKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  if (projects.length === 0) {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: DIM, fontSize: 13 }}>프로젝트 데이터 없음</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {projects.map(project => {
        const isExpanded = expandedKeys.has(project.key)
        const agents = project.agents ?? []
        const activeCnt = agents.filter((l: any) => l.agent?.lifecycleStage === 'ACTIVE').length
        const gate2Cnt  = agents.filter((l: any) => l.agent?.lifecycleStage === 'GATE2').length
        return (
          <div key={project.key} style={{ background: CARD, border: `1px solid ${BDR}`, borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => toggle(project.key)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'rgba(59,130,246,.12)', color: '#4A6FA5', border: '1px solid rgba(59,130,246,.3)' }}>
                  {project.domain}
                </span>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: 0 }}>{project.name}</p>
                  <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{project.description}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'right', fontSize: 11, color: MUTED }}>
                  <div style={{ color: TEXT, fontWeight: 600 }}>{agents.length}개 에이전트</div>
                  <div>운영 {activeCnt} · Gate2 {gate2Cnt}</div>
                </div>
                <span style={{ color: DIM, fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </button>
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${BDR}` }}>
                {agents.length === 0 ? (
                  <p style={{ fontSize: 11, color: DIM, padding: '10px 20px', fontStyle: 'italic' }}>연결된 에이전트 없음</p>
                ) : agents.map((link: any) => {
                  const agent = link.agent
                  if (!agent) return null
                  const isRetired = agent.lifecycleStage === 'RETIRED'
                  return (
                    <button key={link.id} onClick={() => !isRetired && onAgentClick(agent)} disabled={isRetired}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 20px', background: 'none', border: 'none', borderTop: `1px solid ${BDR}`,
                        cursor: isRetired ? 'default' : 'pointer', textAlign: 'left', opacity: isRetired ? .4 : 1,
                      }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: TEXT, margin: 0 }}>{agent.agentName}</p>
                          <span style={{ fontSize: 10, color: DIM }}>{ROLE_LABEL[link.role] ?? link.role}</span>
                        </div>
                        <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{agent.purpose}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <GateBar g1={agent.gate1Passed} g2={agent.gate2Passed} g3={agent.gate3Passed} />
                        <StageBadge stage={agent.lifecycleStage} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────
function RegistryPageContent() {
  const searchParams = useSearchParams()
  const defaultProjectId  = searchParams.get('projectId') ?? ''
  const highlightAgentId  = searchParams.get('highlight') ?? ''

  const { data: session } = useSession()
  const isAxTeam = (session?.user as any)?.role === 'AX_TEAM'

  const [agentData, setAgentData]         = useState<{ agents: any[]; stageCounts: Record<string, number> }>({ agents: [], stageCounts: {} })
  const [projects, setProjects]           = useState<any[]>([])
  const [approvedProjects, setApprovedProjects] = useState<any[]>([])
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null)
  const [viewMode, setViewMode]           = useState<'agent' | 'project'>('agent')
  const [loading, setLoading]             = useState(true)
  const [loadError, setLoadError]         = useState<string | null>(null)
  const [showRegister, setShowRegister]   = useState(!!defaultProjectId)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [regRes, projRes, myProjRes] = await Promise.all([
        fetch('/api/registry'), fetch('/api/ax-projects'), fetch('/api/projects'),
      ])
      if (!regRes.ok || !projRes.ok) throw new Error('데이터 로드 실패')
      const regJson  = await regRes.json()
      const projJson = await projRes.json()
      const myProj   = await myProjRes.json()
      setAgentData(regJson)
      setProjects(projJson.projects ?? [])
      setApprovedProjects(Array.isArray(myProj) ? myProj.filter((p: any) => ['pilot', 'production'].includes(p.status)) : [])
    } catch (e: any) {
      setLoadError(e.message ?? '데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (highlightAgentId && agentData.agents.length > 0) {
      const target = agentData.agents.find(a => a.id === highlightAgentId)
      if (target) setSelectedAgent(target)
    }
  }, [highlightAgentId, agentData.agents])

  const filtered     = selectedStage ? agentData.agents.filter(a => a.lifecycleStage === selectedStage) : agentData.agents
  const stageAction  = selectedStage ? STAGE_ACTIONS[selectedStage] : null
  const openAgent    = (agent: any) => setSelectedAgent(agentData.agents.find(a => a.id === agent.id) ?? agent)

  const btnTabSt = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
    background: active ? CARD : 'none', color: active ? TEXT : MUTED,
    border: `1px solid ${active ? BDR : 'transparent'}`,
  })

  return (
    <div style={{ color: TEXT, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: TEXT, margin: 0 }}>에이전트 레지스트리</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>전사 AI 에이전트 라이프사이클 관리 — DEVELOPING → GATE1 → GATE2 → GATE3 → ACTIVE</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right', fontSize: 12, color: MUTED }}>
            <div style={{ color: TEXT, fontWeight: 700 }}>총 {agentData.agents.length}개</div>
            <div>활성 {agentData.stageCounts['ACTIVE'] ?? 0}개</div>
          </div>
          <Link href="/admin/retired" style={{
            padding: '8px 14px', background: 'none', color: MUTED, border: `1px solid ${BDR}`, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', textDecoration: 'none',
          }}>
            폐기 거버넌스
          </Link>
          {isAxTeam && (
            <button onClick={() => setShowRegister(true)} style={{
              padding: '8px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              + 에이전트 등록
            </button>
          )}
          <div style={{ display: 'flex', gap: 4, background: CARD2, borderRadius: 8, padding: 3, border: `1px solid ${BDR}` }}>
            <button onClick={() => setViewMode('agent')} style={btnTabSt(viewMode === 'agent')}>에이전트 뷰</button>
            <button onClick={() => setViewMode('project')} style={btnTabSt(viewMode === 'project')}>AI 활용 뷰</button>
          </div>
        </div>
      </div>

      {/* 로드 에러 */}
      {loadError && (
        <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#B94040', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠</span>
          <span>{loadError} —</span>
          <button onClick={load} style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 13, cursor: 'pointer', fontWeight: 600, padding: 0 }}>재시도</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: DIM, fontSize: 13 }}>로딩 중...</div>
      ) : viewMode === 'agent' ? (
        <>
          {/* 라이프사이클 파이프라인 바 */}
          <div style={{ background: CARD, border: `1px solid ${BDR}`, borderRadius: 8, padding: '14px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>라이프사이클 단계 (클릭 → 필터)</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {LIFECYCLE_STAGES.map((s, i) => {
                const count       = agentData.stageCounts[s.key] ?? 0
                const isSelected  = selectedStage === s.key
                const needsAttn   = (s.key === 'GATE2' && count > 5) || (s.key === 'DEGRADED' && count > 0)
                return (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      onClick={() => setSelectedStage(isSelected ? null : s.key)}
                      disabled={count === 0}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '8px 14px', borderRadius: 6, minWidth: 72,
                        background: count === 0 ? CARD2 : isSelected ? s.color : CARD,
                        border: `1px solid ${count === 0 ? BDR : isSelected ? s.border : BDR}`,
                        cursor: count === 0 ? 'default' : 'pointer',
                        outline: isSelected ? `2px solid ${s.border}` : 'none',
                        outlineOffset: 2,
                      }}>
                      <span style={{ fontSize: 10, color: count === 0 ? DIM : s.text, fontWeight: 600 }}>{s.label}</span>
                      <span style={{ fontSize: 22, fontWeight: 700, color: count === 0 ? DIM : s.text, lineHeight: 1.2, marginTop: 2 }}>{count}</span>
                      {needsAttn && <span style={{ fontSize: 9, color: s.text, marginTop: 2 }}>⚠ 필요</span>}
                    </button>
                    {i < LIFECYCLE_STAGES.length - 1 && <span style={{ color: BDR, margin: '0 2px', fontSize: 14 }}>→</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 액션 배너 */}
          {stageAction && (
            <div style={{
              borderRadius: 8, padding: '12px 16px',
              background: selectedStage === 'DEGRADED' ? 'rgba(185,64,64,.07)' : selectedStage === 'GATE2' ? 'rgba(217,119,6,.07)' : 'rgba(74,111,165,.07)',
              border: `1px solid ${selectedStage === 'DEGRADED' ? 'rgba(185,64,64,.3)' : selectedStage === 'GATE2' ? 'rgba(217,119,6,.3)' : 'rgba(74,111,165,.25)'}`,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                {LIFECYCLE_STAGES.find(s => s.key === selectedStage)?.label} — {agentData.stageCounts[selectedStage ?? ''] ?? 0}개
              </p>
              <p style={{ fontSize: 12, color: TEXT, lineHeight: 1.6 }}>{stageAction}</p>
            </div>
          )}

          {/* 에이전트 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {filtered.map(agent => {
              const isRetired  = agent.lifecycleStage === 'RETIRED'
              const isDegraded = agent.lifecycleStage === 'DEGRADED'
              const borderColor = isDegraded ? 'rgba(185,64,64,.35)' :
                agent.lifecycleStage === 'ACTIVE' ? 'rgba(5,150,105,.3)' :
                agent.lifecycleStage === 'GATE2'  ? 'rgba(217,119,6,.3)' : BDR
              return (
                <button key={agent.id} onClick={() => !isRetired && openAgent(agent)} disabled={isRetired}
                  style={{
                    background: CARD, border: `1px solid ${borderColor}`, borderRadius: 8, padding: '14px 16px',
                    textAlign: 'left', cursor: isRetired ? 'default' : 'pointer', opacity: isRetired ? .4 : 1,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: 0, lineHeight: 1.3 }}>
                      {isDegraded && '⚠ '}{agent.agentName}
                    </p>
                    <StageBadge stage={agent.lifecycleStage} />
                  </div>
                  <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' as any }}>
                    {agent.purpose}
                  </p>
                  {(agent.projects ?? []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {(agent.projects ?? []).map((link: any) => (
                        <span key={link.projectId} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,.1)', color: '#4A6FA5', border: '1px solid rgba(59,130,246,.25)' }}>
                          {link.project?.name ?? ''}
                        </span>
                      ))}
                    </div>
                  )}
                  <GateBar g1={agent.gate1Passed} g2={agent.gate2Passed} g3={agent.gate3Passed} />
                  <FallbackBar rate={agent.fallbackRate} />
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DIM }}>
                    <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.dataSource?.split(' ')[0]}</span>
                    <span style={{ color: agent.realDataConnected ? '#34D399' : DIM }}>
                      {agent.realDataConnected ? '✓ 실데이터' : '○ Mock'}
                    </span>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: DIM, fontSize: 13 }}>
                {selectedStage ? `${LIFECYCLE_STAGES.find(s => s.key === selectedStage)?.label} 단계 에이전트 없음` : '에이전트 없음'}
              </div>
            )}
          </div>
        </>
      ) : (
        <ProjectView projects={projects} onAgentClick={openAgent} />
      )}

      {selectedAgent && (
        <SlideOver agent={selectedAgent} allProjects={projects} onClose={() => setSelectedAgent(null)} onStageChange={load} />
      )}
      {showRegister && isAxTeam && (
        <RegisterModal approvedProjects={approvedProjects} defaultProjectId={defaultProjectId} onClose={() => setShowRegister(false)} onCreated={load} />
      )}
    </div>
  )
}

// ── Suspense 래퍼 (useSearchParams 경계) ──────────────────────
export default function RegistryPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '60px 0', color: '#BEC8DC', fontSize: 13 }}>로딩 중...</div>}>
      <RegistryPageContent />
    </Suspense>
  )
}
