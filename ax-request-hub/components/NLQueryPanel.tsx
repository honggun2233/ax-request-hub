'use client'

import { useState } from 'react'

type QueryResult = {
  sql: string
  explanation: string
  rows: Record<string, unknown>[]
  error: string | null
}

const EXAMPLES = [
  'GATE 통과한 에이전트 몇 개야?',
  '이번 달 데이터 신청 현황 보여줘',
  '아직 심의 중인 과제 목록',
  'AI 레벨 3 이상 직원 몇 명이야?',
  '최근 감사로그 10건 보여줘',
  '도구 계정 배정 현황',
]

export function NLQueryPanel() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [showSql, setShowSql] = useState(false)

  async function run(q: string) {
    if (!q.trim()) return
    setLoading(true)
    setResult(null)
    setShowSql(false)
    try {
      const res = await fetch('/api/nl-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      setResult({ sql: '', explanation: '', rows: [], error: e?.message ?? '요청 실패' })
    } finally {
      setLoading(false)
    }
  }

  const columns = result?.rows?.length ? Object.keys(result.rows[0]) : []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-1">🔍 자연어 쿼리</h2>
        <p className="text-sm text-[var(--muted)]">한국어로 질문하면 Claude가 DB를 조회합니다.</p>
      </div>

      {/* 예시 버튼 */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => { setQuestion(ex); run(ex) }}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-600 hover:text-blue-700 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* 입력 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run(question)}
          placeholder="예: GATE3 통과한 에이전트 목록"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => run(question)}
          disabled={loading || !question.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '조회 중…' : '조회'}
        </button>
      </div>

      {/* 결과 */}
      {result && (
        <div className="space-y-3">
          {/* SQL 토글 */}
          {result.sql && (
            <div>
              <button
                onClick={() => setShowSql(!showSql)}
                className="text-xs text-[var(--muted)] hover:text-gray-600 underline"
              >
                {showSql ? '▲ SQL 숨기기' : '▼ 생성된 SQL 보기'}
              </button>
              {showSql && (
                <pre className="mt-2 p-3 bg-[var(--bg)] text-green-400 text-xs rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {result.sql}
                </pre>
              )}
              {result.explanation && (
                <p className="mt-1 text-xs text-[var(--muted)] italic">{result.explanation}</p>
              )}
            </div>
          )}

          {/* 에러 */}
          {result.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {result.error}
            </div>
          )}

          {/* 테이블 */}
          {!result.error && result.rows.length === 0 && (
            <p className="text-sm text-[var(--muted)] text-center py-4">조회 결과가 없습니다.</p>
          )}
          {!result.error && result.rows.length > 0 && (
            <div>
              <p className="text-xs text-[var(--muted)] mb-2">{result.rows.length}건 조회됨</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {columns.map((col) => (
                        <th key={col} className="px-4 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {columns.map((col) => (
                          <td key={col} className="px-4 py-2 text-gray-700 whitespace-nowrap text-xs">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
