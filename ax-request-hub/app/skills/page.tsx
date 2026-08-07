'use client'

import { useState, useEffect, useCallback } from 'react'

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

// 인라인 스타일 객체로 v6 파스텔 배지 정의
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active:     { background: 'rgba(16,185,129,.10)',  color: '#059669', fontWeight: 600 },
  draft:      { background: 'rgba(136,152,187,.12)', color: MUTED,     fontWeight: 600 },
  deprecated: { background: 'rgba(190,200,220,.15)', color: DIM,       fontWeight: 600 },
}
const SEC_STYLE: Record<string, React.CSSProperties> = {
  G1: { background: 'rgba(74,111,165,.10)', color: BLUE },
  G2: { background: 'rgba(74,111,165,.10)', color: BLUE },
  G3: { background: 'rgba(74,111,165,.10)', color: BLUE },
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

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('전체')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Skill | null>(null)
  const [copied, setCopied] = useState(false)
  const [ratingInput, setRatingInput] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingDone, setRatingDone] = useState(false)

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

  function copyPrompt(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    fetch('/api/skills/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: selected?.id, score: 5 }),
    }).catch(() => {})
  }

  async function submitRating() {
    if (!selected) return
    await fetch('/api/skills/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: selected.id, score: ratingInput, comment: ratingComment }),
    })
    setRatingDone(true)
    setRatingComment('')
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', gap: 16, color: TEXT }}>
      {/* 좌: 스킬 목록 */}
      <div style={{ width: 288, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: 0 }}>AI 스킬 카탈로그</h1>
        <input
          type="text"
          placeholder="검색..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{
            border: `1px solid ${LINE}`, borderRadius: 8, padding: '8px 12px',
            fontSize: 14, outline: 'none', color: TEXT, background: SURFACE,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = BLUE_MD)}
          onBlur={e => (e.currentTarget.style.borderColor = LINE)}
        />
        {/* 카테고리 필터 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                fontSize: 12, padding: '4px 8px', borderRadius: 9999,
                border: `1px solid ${category === cat ? BLUE : LINE}`,
                background: category === cat ? BLUE : SURFACE,
                color: category === cat ? '#ffffff' : MUTED,
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 스킬 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading && <p style={{ fontSize: 14, color: DIM, textAlign: 'center', paddingTop: 16 }}>로딩 중...</p>}
          {!loading && skills.length === 0 && (
            <p style={{ fontSize: 14, color: DIM, textAlign: 'center', paddingTop: 16 }}>
              스킬이 없습니다.<br /><span style={{ fontSize: 12 }}>관리자에게 등록을 요청하세요.</span>
            </p>
          )}
          {skills.map(skill => (
            <button
              key={skill.id}
              onClick={() => { setSelected(skill); setRatingDone(false) }}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${selected?.id === skill.id ? BLUE_MD : LINE}`,
                background: selected?.id === skill.id ? 'rgba(74,111,165,.06)' : SURFACE,
                cursor: 'pointer', transition: 'all .15s',
              }}
              onMouseEnter={e => { if (selected?.id !== skill.id) e.currentTarget.style.borderColor = DIM }}
              onMouseLeave={e => { if (selected?.id !== skill.id) e.currentTarget.style.borderColor = LINE }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name}</span>
                <span style={{
                  fontSize: 11, padding: '1px 6px', borderRadius: 4,
                  ...(SEC_STYLE[skill.securityLevel] ?? { background: 'rgba(190,200,220,.15)', color: DIM }),
                }}>
                  {skill.securityLevel}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: MUTED }}>{skill.category}</span>
                {skill.avgRating && (
                  <span style={{ fontSize: 12, color: '#D97706' }}>★ {skill.avgRating.toFixed(1)}</span>
                )}
                <span style={{ fontSize: 12, color: DIM }}>사용 {skill.usageCount}회</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 우: 스킬 상세 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selected ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: DIM }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 14 }}>스킬을 선택하면 상세 내용과 복사 버튼이 표시됩니다</p>
          </div>
        ) : (
          <div style={{ background: SURFACE, borderRadius: 12, border: `1px solid ${LINE}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 헤더 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: 0 }}>{selected.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 12, padding: '2px 8px', borderRadius: 9999,
                      ...(STATUS_STYLE[selected.status] ?? { background: 'rgba(190,200,220,.15)', color: DIM, fontWeight: 600 }),
                    }}>
                      {STATUS_LABEL[selected.status] ?? selected.status}
                    </span>
                    <span style={{
                      fontSize: 12, padding: '2px 8px', borderRadius: 9999,
                      ...(SEC_STYLE[selected.securityLevel] ?? { background: 'rgba(190,200,220,.15)', color: DIM }),
                    }}>
                      {selected.securityLevel}
                    </span>
                    <span style={{ fontSize: 12, color: DIM }}>v{selected.version}</span>
                    <span style={{ fontSize: 12, color: DIM }}>카테고리: {selected.category}</span>
                    <span style={{ fontSize: 12, color: DIM }}>작성: {selected.author}</span>
                  </div>
                </div>
                {selected.avgRating && (
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

            {/* 목적 */}
            {selected.purpose && (
              <section>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>🎯 목적</h3>
                <p style={{ fontSize: 14, color: MUTED, whiteSpace: 'pre-wrap', margin: 0 }}>{selected.purpose}</p>
              </section>
            )}

            {/* 사용 방법 */}
            {selected.instructions && (
              <section>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>📖 사용 방법</h3>
                <p style={{ fontSize: 14, color: MUTED, whiteSpace: 'pre-wrap', margin: 0 }}>{selected.instructions}</p>
              </section>
            )}

            {/* 프롬프트 — 핵심 */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0 }}>📝 프롬프트</h3>
                <button
                  onClick={() => copyPrompt(selected.promptText)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, padding: '6px 12px', borderRadius: 8,
                    fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'background .15s',
                    background: copied ? '#059669' : BLUE, color: '#ffffff',
                  }}
                >
                  {copied ? '✅ 복사됨!' : '📋 프롬프트 복사 (Claude에 붙여넣기)'}
                </button>
              </div>
              <pre style={{
                background: BG, border: `1px solid ${LINE}`, borderRadius: 8,
                padding: 16, fontSize: 12, color: TEXT, whiteSpace: 'pre-wrap',
                overflowX: 'auto', maxHeight: 240, overflowY: 'auto', margin: 0,
              }}>
                {selected.promptText}
              </pre>
            </section>

            {/* 예시 */}
            {selected.examples && (
              <section>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>💡 예시 입출력</h3>
                <pre style={{
                  background: 'rgba(74,111,165,.06)', border: `1px solid rgba(74,111,165,.15)`,
                  borderRadius: 8, padding: 12, fontSize: 12, color: TEXT,
                  whiteSpace: 'pre-wrap', margin: 0,
                }}>{selected.examples}</pre>
              </section>
            )}

            {/* 주의사항 */}
            {selected.cautions && (
              <section>
                <div style={{
                  background: 'rgba(184,149,106,.08)', borderLeft: '4px solid #B8956A',
                  borderRadius: '0 8px 8px 0', padding: 12,
                }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: '#B8956A', marginBottom: 4 }}>⚠️ 주의사항</h3>
                  <p style={{ fontSize: 12, color: '#9A7850', whiteSpace: 'pre-wrap', margin: 0 }}>{selected.cautions}</p>
                </div>
              </section>
            )}

            {/* 평점 */}
            <section style={{ borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 8 }}>⭐ 사용 평점 남기기</h3>
              {ratingDone ? (
                <p style={{ fontSize: 14, color: '#059669' }}>평점이 등록됐습니다. 감사합니다!</p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: MUTED, display: 'block', marginBottom: 4 }}>점수</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1, 2, 3, 4, 5].map(s => (
                        <button
                          key={s}
                          onClick={() => setRatingInput(s)}
                          style={{
                            fontSize: 20, border: 'none', background: 'none', cursor: 'pointer',
                            color: s <= ratingInput ? '#D97706' : DIM, transition: 'color .15s',
                          }}
                        >★</button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="한줄 후기 (선택)"
                    value={ratingComment}
                    onChange={e => setRatingComment(e.target.value)}
                    style={{
                      flex: 1, border: `1px solid ${LINE}`, borderRadius: 8,
                      padding: '6px 12px', fontSize: 14, outline: 'none',
                      color: TEXT, background: SURFACE,
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = BLUE_MD)}
                    onBlur={e => (e.currentTarget.style.borderColor = LINE)}
                  />
                  <button
                    onClick={submitRating}
                    style={{
                      fontSize: 14, background: BLUE, color: '#ffffff',
                      padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    }}
                  >등록</button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
