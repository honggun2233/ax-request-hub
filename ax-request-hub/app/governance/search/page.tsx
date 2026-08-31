// 검색 서버 실행 필요:
//   uvicorn scripts.governance.search_server:app --port 8700
'use client'

import { useState, useRef } from 'react'
import { FileSearch, Search, Loader2, AlertCircle } from 'lucide-react'

interface ChunkResult {
  chunk_id: string
  doc_id: string
  article_no: string
  article_title: string
  text: string
  risk_level: string
  similarity: number
}

const RISK_BADGE: Record<string, string> = {
  고위험: 'bg-red-100 text-red-700 border-red-200',
  중위험: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  저위험: 'bg-green-100 text-green-700 border-green-200',
  해당없음: 'bg-gray-100 text-gray-500 border-gray-200',
}

function similarityBar(pct: number) {
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-gray-300'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-500 w-9 text-right">{pct}%</span>
    </div>
  )
}

export default function GovernanceSearchPage() {
  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(5)
  const [chunks, setChunks] = useState<ChunkResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/governance/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), top_k: topK, is_latest: true }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail ?? d.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      const sorted = [...(data.chunks ?? [])].sort((a, b) => b.similarity - a.similarity)
      setChunks(sorted)
      setSearched(true)
    } catch (err: any) {
      setError(err.message ?? '검색 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <FileSearch className="h-6 w-6 text-[#B8956A]" />
        <div>
          <h1 className="text-xl font-bold text-[#18243D]">거버넌스 문서 검색</h1>
          <p className="text-sm text-gray-400">자연어로 AI 운영규정·지침·가이드라인 조문을 검색합니다</p>
        </div>
      </div>

      {/* 검색 폼 */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-[#E4E9F2] p-5 shadow-sm">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: G3 데이터 승인 절차, 고위험 에이전트 통제 요건, 위원회 심의 기준…"
              className="w-full pl-9 pr-4 py-2.5 border border-[#E4E9F2] rounded-lg text-sm text-[#18243D] placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#B8956A]/30 focus:border-[#B8956A]"
            />
          </div>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="border border-[#E4E9F2] rounded-lg px-3 py-2.5 text-sm text-[#18243D] bg-white focus:outline-none focus:ring-2 focus:ring-[#B8956A]/30"
          >
            {[3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>상위 {n}건</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1E3560] text-white text-sm font-medium rounded-lg hover:bg-[#2A4576] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            검색
          </button>
        </div>
      </form>

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">검색 오류</p>
            <p className="text-red-500 mt-0.5">{error}</p>
            <p className="text-red-400 text-xs mt-1">검색 서버가 실행 중인지 확인하세요 (포트 8700)</p>
          </div>
        </div>
      )}

      {/* 결과 */}
      {searched && !loading && !error && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {chunks.length > 0
              ? `"${query}" 검색 결과 ${chunks.length}건`
              : `"${query}"에 대한 결과가 없습니다.`}
          </p>

          {chunks.map((chunk) => {
            const pct = Math.round(chunk.similarity * 100)
            const riskClass = RISK_BADGE[chunk.risk_level] ?? RISK_BADGE['해당없음']
            return (
              <div
                key={chunk.chunk_id}
                className="bg-white rounded-xl border border-[#E4E9F2] p-5 shadow-sm hover:border-[#B8956A]/40 transition-colors"
              >
                {/* 상단 메타 */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded">
                        {chunk.doc_id}
                      </span>
                      <span className="text-[11px] text-gray-400">{chunk.article_no}</span>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded border ${riskClass}`}
                      >
                        {chunk.risk_level}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-semibold text-[#18243D] truncate">
                      {chunk.article_title}
                    </h3>
                  </div>
                  <div className="w-28 shrink-0 pt-1">
                    {similarityBar(pct)}
                  </div>
                </div>

                {/* 본문 */}
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                  {chunk.text}
                </p>

                {/* 하단 chunk_id */}
                <p className="mt-3 text-[10px] font-mono text-gray-300 truncate">{chunk.chunk_id}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* 초기 안내 */}
      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <FileSearch className="h-12 w-12 mb-3" />
          <p className="text-sm">검색어를 입력하고 Enter를 누르세요</p>
          <p className="text-xs mt-1">pgvector cosine similarity 기반 의미 검색</p>
        </div>
      )}
    </div>
  )
}
