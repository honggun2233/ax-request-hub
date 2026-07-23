'use client'

import { useState, useEffect, useCallback } from 'react'

const CATEGORIES = ['전체', '업무자동화', 'ETF운용', '리서치', '문서작성', '데이터분석', '기타']
const STATUS_BADGE: Record<string, string> = {
  active:     'bg-green-100 text-green-700',
  draft:      'bg-yellow-100 text-yellow-700',
  deprecated: 'bg-gray-100 text-gray-500',
}
const SEC_BADGE: Record<string, string> = {
  G1: 'bg-blue-50 text-blue-600',
  G2: 'bg-orange-50 text-orange-600',
  G3: 'bg-red-50 text-red-600',
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
    // usageCount increment via rate endpoint
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
    <div className="flex h-[calc(100vh-48px)] gap-4">
      {/* 좌: 스킬 목록 */}
      <div className="w-72 shrink-0 flex flex-col gap-3">
        <h1 className="text-lg font-bold text-gray-900">AI 스킬 카탈로그</h1>
        <input
          type="text"
          placeholder="검색..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-xs px-2 py-1 rounded-full border transition ${
                category === cat
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 스킬 목록 */}
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {loading && <p className="text-sm text-gray-400 text-center pt-4">로딩 중...</p>}
          {!loading && skills.length === 0 && (
            <p className="text-sm text-gray-400 text-center pt-4">
              스킬이 없습니다.<br /><span className="text-xs">관리자에게 등록을 요청하세요.</span>
            </p>
          )}
          {skills.map(skill => (
            <button
              key={skill.id}
              onClick={() => { setSelected(skill); setRatingDone(false) }}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition ${
                selected?.id === skill.id
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-100 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-medium text-gray-900 truncate">{skill.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${SEC_BADGE[skill.securityLevel] ?? 'bg-gray-100 text-gray-500'}`}>
                  {skill.securityLevel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{skill.category}</span>
                {skill.avgRating && (
                  <span className="text-xs text-yellow-600">★ {skill.avgRating.toFixed(1)}</span>
                )}
                <span className="text-xs text-gray-400">사용 {skill.usageCount}회</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 우: 스킬 상세 */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="text-5xl mb-3">📋</div>
            <p className="text-sm">스킬을 선택하면 상세 내용과 복사 버튼이 표시됩니다</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-6 space-y-5">
            {/* 헤더 */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[selected.status] ?? ''}`}>
                      {selected.status === 'active' ? '✅ 공식 승인' : selected.status === 'draft' ? '🔧 초안' : '📦 deprecated'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SEC_BADGE[selected.securityLevel]}`}>
                      {selected.securityLevel}
                    </span>
                    <span className="text-xs text-gray-400">v{selected.version}</span>
                    <span className="text-xs text-gray-400">카테고리: {selected.category}</span>
                    <span className="text-xs text-gray-400">작성: {selected.author}</span>
                  </div>
                </div>
                {selected.avgRating && (
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-yellow-500">★ {selected.avgRating.toFixed(1)}</div>
                    <div className="text-xs text-gray-400">{selected.ratingCount}명 평가</div>
                  </div>
                )}
              </div>
              {selected.approvedBy && (
                <p className="text-xs text-gray-400 mt-1">
                  승인: {selected.approvedBy} {selected.approvedAt ? `(${new Date(selected.approvedAt).toLocaleDateString('ko-KR')})` : ''}
                </p>
              )}
            </div>

            {/* 목적 */}
            {selected.purpose && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">🎯 목적</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selected.purpose}</p>
              </section>
            )}

            {/* 사용 방법 */}
            {selected.instructions && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">📖 사용 방법</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selected.instructions}</p>
              </section>
            )}

            {/* 프롬프트 — 핵심 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">📝 프롬프트</h3>
                <button
                  onClick={() => copyPrompt(selected.promptText)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                    copied
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copied ? '✅ 복사됨!' : '📋 프롬프트 복사 (Claude에 붙여넣기)'}
                </button>
              </div>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-800 whitespace-pre-wrap overflow-x-auto max-h-60 overflow-y-auto">
                {selected.promptText}
              </pre>
            </section>

            {/* 예시 */}
            {selected.examples && (
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">💡 예시 입출력</h3>
                <pre className="bg-blue-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap">{selected.examples}</pre>
              </section>
            )}

            {/* 주의사항 */}
            {selected.cautions && (
              <section>
                <div className="bg-orange-50 border-l-4 border-orange-400 rounded-r-lg p-3">
                  <h3 className="text-xs font-semibold text-orange-700 mb-1">⚠️ 주의사항</h3>
                  <p className="text-xs text-orange-600 whitespace-pre-wrap">{selected.cautions}</p>
                </div>
              </section>
            )}

            {/* 평점 */}
            <section className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">⭐ 사용 평점 남기기</h3>
              {ratingDone ? (
                <p className="text-sm text-green-600">평점이 등록됐습니다. 감사합니다!</p>
              ) : (
                <div className="flex items-end gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">점수</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button
                          key={s}
                          onClick={() => setRatingInput(s)}
                          className={`text-xl transition ${s <= ratingInput ? 'text-yellow-400' : 'text-gray-200'}`}
                        >★</button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="한줄 후기 (선택)"
                    value={ratingComment}
                    onChange={e => setRatingComment(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={submitRating}
                    className="text-sm bg-gray-800 text-white px-4 py-1.5 rounded-lg hover:bg-gray-900"
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
