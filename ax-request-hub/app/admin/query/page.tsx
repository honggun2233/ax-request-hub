'use client'
import { useState, useRef } from 'react'

type QueryResult = {
  sql: string
  explanation: string
  rows: Record<string, unknown>[]
  error: string | null
  attempts: number
}

const EXAMPLES = [
  '부서별 AI 도구 보유 직원 수를 알려줘',
  '최근 30일 이내 승인된 데이터 신청 목록',
  '레벨별 직원 분포를 보여줘',
  '파일럿 단계 이상인 AI 과제 목록',
  'GATE2 이상인 에이전트 현황',
]

export default function NLQueryPage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const run = async (q?: string) => {
    const query = (q ?? question).trim()
    if (!query) return
    if (q) setQuestion(q)
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/nl-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ sql: '', explanation: '', rows: [], error: data.error ?? `HTTP ${res.status}`, attempts: 0 })
      } else {
        setResult(data)
      }
    } catch (e: any) {
      setResult({ sql: '', explanation: '', rows: [], error: e?.message ?? '요청 실패', attempts: 0 })
    } finally {
      setLoading(false)
    }
  }

  const colKeys = result?.rows?.length ? Object.keys(result.rows[0]) : []

  return (
    <div className="max-w-5xl space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text1)]">AI 자연어 질의</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          한국어로 질문하면 AI가 SQL을 생성해 AX Hub 데이터를 조회합니다. SELECT만 허용됩니다.
        </p>
      </div>

      {/* 질문 입력 */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-5 space-y-3">
        <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">질문</label>
        <textarea
          ref={textareaRef}
          className="w-full border border-[var(--border)] rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#FFD700]/40"
          rows={3}
          placeholder="예) 이번 달 데이터 신청이 가장 많은 부서는 어디야?"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run()
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">Ctrl+Enter로 실행</p>
          <button
            onClick={() => run()}
            disabled={loading || !question.trim()}
            className="px-5 py-2 bg-[#0E0E0E] text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-[#162847] transition-colors"
          >
            {loading ? '분석 중...' : '질의 실행'}
          </button>
        </div>
      </div>

      {/* 예시 질문 */}
      <div>
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">예시 질문</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => run(ex)}
              className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-full text-[var(--text2)] hover:border-[#FFD700] hover:text-[#FFD700] transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 요약 / 에러 */}
          {result.error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {result.error}
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1">
              <p className="text-sm font-medium text-blue-900">{result.explanation}</p>
              <p className="text-xs text-blue-500">AI 시도 {result.attempts}회 · {result.rows.length}행 반환</p>
            </div>
          )}

          {/* SQL */}
          {result.sql && (
            <div className="bg-[#0F172A] rounded-xl p-4 overflow-x-auto">
              <pre className="text-[#94D2BD] text-xs leading-relaxed whitespace-pre-wrap">{result.sql}</pre>
            </div>
          )}

          {/* 결과 테이블 */}
          {colKeys.length > 0 && (
            <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text1)]">결과</p>
                <span className="text-xs text-[var(--muted)]">{result.rows.length}행</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--surface2)]">
                      {colKeys.map(k => (
                        <th key={k} className="text-left px-4 py-2.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide border-b border-[var(--border)]">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface2)] transition-colors">
                        {colKeys.map(k => (
                          <td key={k} className="px-4 py-2.5 text-[var(--text2)] max-w-[240px] truncate">
                            {row[k] == null ? <span className="text-[var(--muted)]">—</span> : String(row[k])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!result.error && result.rows.length === 0 && (
            <p className="text-sm text-[var(--muted)] text-center py-6">조회 결과가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
