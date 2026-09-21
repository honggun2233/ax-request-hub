'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

const BLUE    = '#4A6FA5'
const BLUE_MD = '#6B8FC9'
const TEXT    = '#18243D'
const MUTED   = '#8898BB'
const LINE    = '#E4E9F2'
const SURFACE = '#FFFFFF'
const BG      = '#F7F9FC'
const NAVY    = '#1E3560'
const DIM     = '#BEC8DC'

const CATEGORIES = ['전체', '업무자동화', 'ETF운용', '리서치', '문서작성', '데이터분석', '기타']
const SEC_LEVELS = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET']

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active:     { background: 'rgba(16,185,129,.10)',  color: '#059669', fontWeight: 600 },
  draft:      { background: 'rgba(136,152,187,.12)', color: MUTED,     fontWeight: 600 },
  deprecated: { background: 'rgba(190,200,220,.15)', color: DIM,       fontWeight: 600 },
}
const SEC_STYLE: Record<string, React.CSSProperties> = {
  PUBLIC:       { background: 'rgba(74,111,165,.10)', color: BLUE },
  RESTRICTED:   { background: 'rgba(208,123,58,.10)', color: '#D97706' },
  CONFIDENTIAL: { background: 'rgba(184,84,69,.10)',  color: '#DC2626' },
  SECRET:       { background: 'rgba(100,0,0,.12)',    color: '#991B1B' },
}
const STATUS_LABEL: Record<string, string> = {
  active:     '✅ 공식 승인',
  draft:      '🔧 초안',
  deprecated: '📦 deprecated',
}

interface Skill {
  id: string
  skillId: string
  name: string
  version: string
  category: string
  author: string
  status: string
  securityLevel: string
  purpose: string
  instructions: string
  promptText: string
  examples: string
  cautions: string
  usageCount: number
  avgRating: number | null
  ratingCount: number
  approvedBy: string
  approvedAt: string | null
  createdAt: string
}

const EMPTY_FORM = {
  skillId: '', name: '', category: '업무자동화', author: 'AX팀',
  version: '1.0.0', securityLevel: 'PUBLIC', status: 'draft',
  purpose: '', instructions: '', promptText: '', examples: '', cautions: '',
}

// ─── 카탈로그 탭 ────────────────────────────────────────────────────────────

function CatalogTab({ isAdmin }: { isAdmin: boolean }) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('전체')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Skill | null>(null)
  const [copied, setCopied] = useState(false)
  const [ratingInput, setRatingInput] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingDone, setRatingDone] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status: 'active' })
    if (category !== '전체') params.set('category', category)
    if (q) params.set('q', q)
    const res = await fetch(`/api/skills?${params}`)
    const data = await res.json()
    setSkills(data.skills ?? [])
    setLoading(false)
  }, [category, q])

  useEffect(() => { load() }, [load])

  async function runSeed() {
    setSeeding(true); setSeedResult(null)
    try {
      const res = await fetch('/api/skills/seed', { method: 'POST' })
      const data = await res.json()
      setSeedResult(res.ok ? `✅ ${data.seeded ?? '완료'} 개 시드 완료` : `❌ ${data.error ?? '오류'}`)
      if (res.ok) load()
    } catch { setSeedResult('❌ 네트워크 오류') }
    finally { setSeeding(false) }
  }

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    fetch('/api/skills/rate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: selected?.id, score: 5 }),
    }).catch(() => {})
  }

  async function submitRating() {
    if (!selected) return
    await fetch('/api/skills/rate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: selected.id, score: ratingInput, comment: ratingComment }),
    })
    setRatingDone(true); setRatingComment('')
  }

  return (
    <div style={{ display: 'flex', flex: 1, gap: 16, overflow: 'hidden' }}>
      {/* 좌: 목록 */}
      <div style={{ width: 288, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: 0 }}>프롬프트 카탈로그</h1>
          {isAdmin && (
            <button onClick={runSeed} disabled={seeding} title="시드 데이터 upsert (AX팀 전용)"
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${LINE}`,
                background: SURFACE, color: MUTED, cursor: seeding ? 'default' : 'pointer',
                opacity: seeding ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {seeding ? '시드 중...' : '🌱 시드 추가'}
            </button>
          )}
        </div>
        {seedResult && (
          <p style={{ fontSize: 12, color: seedResult.startsWith('✅') ? '#059669' : '#DC2626', margin: 0 }}>
            {seedResult}
          </p>
        )}
        <input type="text" placeholder="검색..." value={q} onChange={e => setQ(e.target.value)}
          style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '8px 12px',
            fontSize: 14, outline: 'none', color: TEXT, background: SURFACE }}
          onFocus={e => (e.currentTarget.style.borderColor = BLUE_MD)}
          onBlur={e => (e.currentTarget.style.borderColor = LINE)}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 9999,
                border: `1px solid ${category === cat ? BLUE : LINE}`,
                background: category === cat ? BLUE : SURFACE,
                color: category === cat ? '#ffffff' : MUTED, cursor: 'pointer' }}>
              {cat}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading && <p style={{ fontSize: 14, color: DIM, textAlign: 'center', paddingTop: 16 }}>로딩 중...</p>}
          {!loading && skills.length === 0 && (
            <p style={{ fontSize: 14, color: DIM, textAlign: 'center', paddingTop: 16 }}>
              스킬이 없습니다.<br /><span style={{ fontSize: 12 }}>관리자에게 등록을 요청하세요.</span>
            </p>
          )}
          {skills.map(skill => (
            <button key={skill.id} onClick={() => { setSelected(skill); setRatingDone(false) }}
              style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${selected?.id === skill.id ? BLUE_MD : LINE}`,
                background: selected?.id === skill.id ? 'rgba(74,111,165,.06)' : SURFACE, cursor: 'pointer' }}
              onMouseEnter={e => { if (selected?.id !== skill.id) e.currentTarget.style.borderColor = DIM }}
              onMouseLeave={e => { if (selected?.id !== skill.id) e.currentTarget.style.borderColor = LINE }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name}</span>
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, ...(SEC_STYLE[skill.securityLevel] ?? { background: 'rgba(190,200,220,.15)', color: DIM }) }}>
                  {skill.securityLevel}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: MUTED }}>{skill.category}</span>
                {skill.avgRating != null && <span style={{ fontSize: 12, color: '#D97706' }}>★ {skill.avgRating.toFixed(1)}</span>}
                <span style={{ fontSize: 12, color: DIM }}>사용 {skill.usageCount}회</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 우: 상세 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selected ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: DIM }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 14 }}>스킬을 선택하면 상세 내용과 복사 버튼이 표시됩니다</p>
          </div>
        ) : (
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${LINE}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: 0 }}>{selected.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 9999, ...(STATUS_STYLE[selected.status] ?? {}) }}>
                      {STATUS_LABEL[selected.status] ?? selected.status}
                    </span>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 9999, ...(SEC_STYLE[selected.securityLevel] ?? { background: 'rgba(190,200,220,.15)', color: DIM }) }}>
                      {selected.securityLevel}
                    </span>
                    <span style={{ fontSize: 12, color: DIM }}>v{selected.version}</span>
                    <span style={{ fontSize: 12, color: DIM }}>카테고리: {selected.category}</span>
                    <span style={{ fontSize: 12, color: DIM }}>작성: {selected.author}</span>
                  </div>
                </div>
                {selected.avgRating != null && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#D97706' }}>★ {selected.avgRating.toFixed(1)}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{selected.ratingCount}명 평가</div>
                  </div>
                )}
              </div>
              {selected.approvedBy && (
                <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                  승인: {selected.approvedBy} {selected.approvedAt ? `(${new Date(selected.approvedAt).toLocaleDateString('ko-KR')})` : ''}
                </p>
              )}
            </div>
            {selected.purpose && (
              <section>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>🎯 목적</h3>
                <p style={{ fontSize: 14, color: MUTED, whiteSpace: 'pre-wrap', margin: 0 }}>{selected.purpose}</p>
              </section>
            )}
            {selected.instructions && (
              <section>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>📖 사용 방법</h3>
                <p style={{ fontSize: 14, color: MUTED, whiteSpace: 'pre-wrap', margin: 0 }}>{selected.instructions}</p>
              </section>
            )}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0 }}>📝 프롬프트</h3>
                <button onClick={() => copyPrompt(selected.promptText)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px',
                    borderRadius: 8, fontWeight: 500, cursor: 'pointer', border: 'none',
                    background: copied ? '#059669' : BLUE, color: '#ffffff' }}>
                  {copied ? '✅ 복사됨!' : '📋 프롬프트 복사 (Claude에 붙여넣기)'}
                </button>
              </div>
              <pre style={{ background: BG, border: `1px solid ${LINE}`, borderRadius: 8, padding: 16,
                fontSize: 12, color: TEXT, whiteSpace: 'pre-wrap', overflowX: 'auto', maxHeight: 240, overflowY: 'auto', margin: 0 }}>
                {selected.promptText}
              </pre>
            </section>
            {selected.examples && (
              <section>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>💡 예시 입출력</h3>
                <pre style={{ background: 'rgba(74,111,165,.06)', border: `1px solid rgba(74,111,165,.15)`,
                  borderRadius: 8, padding: 12, fontSize: 12, color: TEXT, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {selected.examples}
                </pre>
              </section>
            )}
            {selected.cautions && (
              <section>
                <div style={{ background: 'rgba(184,149,106,.08)', borderLeft: '4px solid #B8956A', borderRadius: '0 8px 8px 0', padding: 12 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: '#B8956A', marginBottom: 4 }}>⚠️ 주의사항</h3>
                  <p style={{ fontSize: 12, color: '#9A7850', whiteSpace: 'pre-wrap', margin: 0 }}>{selected.cautions}</p>
                </div>
              </section>
            )}
            <section style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8 }}>⭐ 사용 평점 남기기</h3>
              {ratingDone ? (
                <p style={{ fontSize: 14, color: '#059669' }}>평점이 등록됐습니다. 감사합니다!</p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: MUTED, display: 'block', marginBottom: 4 }}>점수</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setRatingInput(s)}
                          style={{ fontSize: 20, border: 'none', background: 'none', cursor: 'pointer',
                            color: s <= ratingInput ? '#D97706' : DIM }}>★</button>
                      ))}
                    </div>
                  </div>
                  <input type="text" placeholder="한줄 후기 (선택)" value={ratingComment}
                    onChange={e => setRatingComment(e.target.value)}
                    style={{ flex: 1, border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 12px', fontSize: 14, outline: 'none', color: TEXT, background: SURFACE }}
                    onFocus={e => (e.currentTarget.style.borderColor = BLUE_MD)}
                    onBlur={e => (e.currentTarget.style.borderColor = LINE)}
                  />
                  <button onClick={submitRating}
                    style={{ fontSize: 14, background: BLUE, color: '#ffffff', padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
                    등록
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 관리 탭 ────────────────────────────────────────────────────────────────

function AdminTab() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Skill | null>(null)
  const [patchLoading, setPatchLoading] = useState(false)
  const [patchMsg, setPatchMsg] = useState<string | null>(null)

  // 신규 등록 폼 상태
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState<'manual' | 'json'>('manual')
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/skills?status=all')
    const data = await res.json()
    setSkills(data.skills ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = statusFilter === 'all' ? skills : skills.filter(s => s.status === statusFilter)
  const draftCount = skills.filter(s => s.status === 'draft').length

  async function patchStatus(skill: Skill, status: string) {
    setPatchLoading(true); setPatchMsg(null)
    const res = await fetch('/api/skills', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: skill.id, status }),
    })
    const data = await res.json()
    if (res.ok) {
      setPatchMsg(`✅ ${status === 'active' ? '승인' : '아카이브'} 완료`)
      setSelected(data.skill)
      load()
    } else {
      setPatchMsg(`❌ ${data.error ?? '오류'}`)
    }
    setPatchLoading(false)
  }

  function parseJson() {
    setJsonError(null)
    try {
      const parsed = JSON.parse(jsonInput)
      const obj = Array.isArray(parsed) ? parsed[0] : parsed
      setForm(prev => ({
        ...prev,
        skillId:       obj.skillId       ?? prev.skillId,
        name:          obj.name          ?? prev.name,
        category:      obj.category      ?? prev.category,
        author:        obj.author        ?? prev.author,
        version:       obj.version       ?? prev.version,
        securityLevel: obj.securityLevel ?? prev.securityLevel,
        status:        obj.status        ?? prev.status,
        purpose:       obj.purpose       ?? prev.purpose,
        instructions:  obj.instructions  ?? prev.instructions,
        promptText:    obj.promptText    ?? prev.promptText,
        examples:      obj.examples      ?? prev.examples,
        cautions:      obj.cautions      ?? prev.cautions,
      }))
      setFormMode('manual')
    } catch (e: any) {
      setJsonError(`JSON 파싱 오류: ${e.message}`)
    }
  }

  async function saveSkill() {
    setSaveLoading(true); setSaveMsg(null)
    const res = await fetch('/api/skills', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setSaveMsg('✅ 저장 완료')
      setForm({ ...EMPTY_FORM })
      setJsonInput('')
      setShowForm(false)
      load()
    } else {
      setSaveMsg(`❌ ${data.error ?? '오류'}`)
    }
    setSaveLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${LINE}`, borderRadius: 6, padding: '6px 10px',
    fontSize: 13, outline: 'none', color: TEXT, background: SURFACE, width: '100%',
  }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: MUTED, display: 'block', marginBottom: 3 }

  return (
    <div style={{ display: 'flex', flex: 1, gap: 16, overflow: 'hidden' }}>
      {/* 좌: 목록 */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>스킬 관리</span>
            {draftCount > 0 && (
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 9999,
                background: 'rgba(208,123,58,.15)', color: '#D97706', fontWeight: 700 }}>
                승인 대기 {draftCount}
              </span>
            )}
          </div>
          <button onClick={() => { setShowForm(true); setSelected(null); setSaveMsg(null) }}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6,
              background: BLUE, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
            + 새 스킬
          </button>
        </div>

        {/* status 필터 */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['all','draft','active','deprecated'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 9999, cursor: 'pointer',
                border: `1px solid ${statusFilter === s ? BLUE : LINE}`,
                background: statusFilter === s ? BLUE : SURFACE,
                color: statusFilter === s ? '#fff' : MUTED }}>
              {s === 'all' ? '전체' : s}
            </button>
          ))}
        </div>

        {/* 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {loading && <p style={{ fontSize: 13, color: DIM, textAlign: 'center', paddingTop: 16 }}>로딩 중...</p>}
          {!loading && filtered.length === 0 && (
            <p style={{ fontSize: 13, color: DIM, textAlign: 'center', paddingTop: 16 }}>스킬 없음</p>
          )}
          {filtered.map(skill => (
            <button key={skill.id} onClick={() => { setSelected(skill); setShowForm(false); setPatchMsg(null) }}
              style={{ width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 7,
                border: `1px solid ${selected?.id === skill.id ? BLUE_MD : LINE}`,
                background: selected?.id === skill.id ? 'rgba(74,111,165,.06)' : SURFACE, cursor: 'pointer' }}
              onMouseEnter={e => { if (selected?.id !== skill.id) e.currentTarget.style.borderColor = DIM }}
              onMouseLeave={e => { if (selected?.id !== skill.id) e.currentTarget.style.borderColor = LINE }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {skill.name}
                </span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, flexShrink: 0,
                  ...(STATUS_STYLE[skill.status] ?? { background: 'rgba(190,200,220,.15)', color: DIM, fontWeight: 600 }) }}>
                  {skill.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{skill.category}</span>
                <span style={{ fontSize: 11, color: DIM }}>사용 {skill.usageCount}회</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 우: 상세 / 폼 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* 새 스킬 등록 폼 */}
        {showForm && (
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${LINE}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: NAVY, margin: 0 }}>새 스킬 등록</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['manual','json'] as const).map(m => (
                  <button key={m} onClick={() => { setFormMode(m); setJsonError(null) }}
                    style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6,
                      border: `1px solid ${formMode === m ? BLUE : LINE}`,
                      background: formMode === m ? BLUE : SURFACE,
                      color: formMode === m ? '#fff' : MUTED, cursor: 'pointer' }}>
                    {m === 'manual' ? '직접 입력' : 'JSON 붙여넣기'}
                  </button>
                ))}
              </div>
            </div>

            {/* JSON 모드 */}
            {formMode === 'json' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={labelStyle}>JSON 객체 또는 배열 (첫 번째 항목을 폼에 채웁니다)</label>
                <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)}
                  rows={10} placeholder={'{\n  "skillId": "skill-xxx",\n  "name": "스킬 이름",\n  "category": "업무자동화",\n  "promptText": "..."\n}'}
                  style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }} />
                {jsonError && <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{jsonError}</p>}
                <button onClick={parseJson}
                  style={{ alignSelf: 'flex-start', fontSize: 13, padding: '6px 16px', borderRadius: 6,
                    background: BLUE, color: '#fff', border: 'none', cursor: 'pointer' }}>
                  폼에 적용
                </button>
              </div>
            )}

            {/* 직접 입력 폼 */}
            {formMode === 'manual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>skillId *</label>
                    <input value={form.skillId} onChange={e => setForm(p => ({...p, skillId: e.target.value}))}
                      placeholder="skill-xxx-yyy" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>스킬명 *</label>
                    <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                      placeholder="스킬 이름" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>카테고리 *</label>
                    <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))}
                      style={inputStyle}>
                      {CATEGORIES.filter(c => c !== '전체').map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>보안 등급</label>
                    <select value={form.securityLevel} onChange={e => setForm(p => ({...p, securityLevel: e.target.value}))}
                      style={inputStyle}>
                      {SEC_LEVELS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>작성자</label>
                    <input value={form.author} onChange={e => setForm(p => ({...p, author: e.target.value}))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>버전</label>
                    <input value={form.version} onChange={e => setForm(p => ({...p, version: e.target.value}))}
                      style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>목적</label>
                  <textarea value={form.purpose} onChange={e => setForm(p => ({...p, purpose: e.target.value}))}
                    rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={labelStyle}>사용 방법</label>
                  <textarea value={form.instructions} onChange={e => setForm(p => ({...p, instructions: e.target.value}))}
                    rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={labelStyle}>프롬프트 텍스트 *</label>
                  <textarea value={form.promptText} onChange={e => setForm(p => ({...p, promptText: e.target.value}))}
                    rows={6} style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>예시 입출력</label>
                    <textarea value={form.examples} onChange={e => setForm(p => ({...p, examples: e.target.value}))}
                      rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>주의사항</label>
                    <textarea value={form.cautions} onChange={e => setForm(p => ({...p, cautions: e.target.value}))}
                      rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                </div>
              </div>
            )}

            {saveMsg && (
              <p style={{ fontSize: 13, color: saveMsg.startsWith('✅') ? '#059669' : '#DC2626', margin: 0 }}>
                {saveMsg}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveSkill} disabled={saveLoading}
                style={{ fontSize: 13, padding: '7px 20px', borderRadius: 6,
                  background: saveLoading ? DIM : BLUE, color: '#fff', border: 'none',
                  cursor: saveLoading ? 'default' : 'pointer', fontWeight: 500 }}>
                {saveLoading ? '저장 중...' : 'draft로 저장'}
              </button>
              <button onClick={() => { setShowForm(false); setForm({...EMPTY_FORM}); setJsonInput(''); setSaveMsg(null) }}
                style={{ fontSize: 13, padding: '7px 16px', borderRadius: 6,
                  background: SURFACE, color: MUTED, border: `1px solid ${LINE}`, cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </div>
        )}

        {/* 선택된 스킬 상세 + 상태 관리 */}
        {!showForm && selected && (
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${LINE}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: 0 }}>{selected.name}</h2>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 9999, ...(STATUS_STYLE[selected.status] ?? {}) }}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 9999, ...(SEC_STYLE[selected.securityLevel] ?? { background: 'rgba(190,200,220,.15)', color: DIM }) }}>
                    {selected.securityLevel}
                  </span>
                  <span style={{ fontSize: 12, color: DIM }}>{selected.category}</span>
                  <span style={{ fontSize: 12, color: DIM }}>v{selected.version}</span>
                  <span style={{ fontSize: 12, color: DIM }}>사용 {selected.usageCount}회</span>
                  {selected.avgRating != null && (
                    <span style={{ fontSize: 12, color: '#D97706' }}>★ {selected.avgRating.toFixed(1)} ({selected.ratingCount}명)</span>
                  )}
                </div>
                {selected.approvedBy && (
                  <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                    승인: {selected.approvedBy} {selected.approvedAt ? `(${new Date(selected.approvedAt).toLocaleDateString('ko-KR')})` : ''}
                  </p>
                )}
              </div>
              {/* 상태 변경 버튼 */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {selected.status === 'draft' && (
                  <button onClick={() => patchStatus(selected, 'active')} disabled={patchLoading}
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, fontWeight: 600,
                      background: 'rgba(16,185,129,.12)', color: '#059669', border: '1px solid rgba(16,185,129,.25)',
                      cursor: patchLoading ? 'default' : 'pointer' }}>
                    승인 (active)
                  </button>
                )}
                {selected.status === 'active' && (
                  <button onClick={() => patchStatus(selected, 'deprecated')} disabled={patchLoading}
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6,
                      background: 'rgba(190,200,220,.12)', color: DIM, border: `1px solid ${LINE}`,
                      cursor: patchLoading ? 'default' : 'pointer' }}>
                    아카이브
                  </button>
                )}
                {selected.status === 'deprecated' && (
                  <button onClick={() => patchStatus(selected, 'active')} disabled={patchLoading}
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6,
                      background: 'rgba(16,185,129,.12)', color: '#059669', border: '1px solid rgba(16,185,129,.25)',
                      cursor: patchLoading ? 'default' : 'pointer' }}>
                    복원 (active)
                  </button>
                )}
              </div>
            </div>

            {patchMsg && (
              <p style={{ fontSize: 13, color: patchMsg.startsWith('✅') ? '#059669' : '#DC2626', margin: 0 }}>
                {patchMsg}
              </p>
            )}

            <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selected.purpose && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 3 }}>목적</div>
                  <p style={{ fontSize: 13, color: MUTED, whiteSpace: 'pre-wrap', margin: 0 }}>{selected.purpose}</p>
                </div>
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 3 }}>프롬프트</div>
                <pre style={{ background: BG, border: `1px solid ${LINE}`, borderRadius: 6,
                  padding: 12, fontSize: 12, color: TEXT, whiteSpace: 'pre-wrap',
                  overflowX: 'auto', maxHeight: 200, overflowY: 'auto', margin: 0 }}>
                  {selected.promptText}
                </pre>
              </div>
              {selected.cautions && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#B8956A', marginBottom: 3 }}>⚠️ 주의사항</div>
                  <p style={{ fontSize: 12, color: '#9A7850', whiteSpace: 'pre-wrap', margin: 0 }}>{selected.cautions}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {!showForm && !selected && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: DIM }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚙️</div>
            <p style={{ fontSize: 14 }}>스킬을 선택하거나 새 스킬을 등록하세요</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 메인 페이지 ────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'AX_TEAM'
  const [tab, setTab] = useState<'catalog' | 'admin'>('catalog')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', color: TEXT }}>
      {/* 탭 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: `1px solid ${LINE}`, marginBottom: 16, flexShrink: 0 }}>
        {(['catalog', ...(isAdmin ? ['admin'] : [])] as Array<'catalog' | 'admin'>).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontSize: 14, padding: '8px 20px', border: 'none', background: 'none',
              color: tab === t ? NAVY : MUTED, fontWeight: tab === t ? 700 : 400, cursor: 'pointer',
              borderBottom: `2px solid ${tab === t ? BLUE : 'transparent'}`,
              transition: 'all .15s' }}>
            {t === 'catalog' ? 'GPT 프롬프트 카탈로그' : '관리 (AX팀)'}
          </button>
        ))}
      </div>

      {tab === 'catalog' && <CatalogTab isAdmin={isAdmin} />}
      {tab === 'admin' && isAdmin && <AdminTab />}
    </div>
  )
}
