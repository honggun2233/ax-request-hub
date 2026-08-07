'use client'

import React, { useState, useEffect } from 'react'

// 문서 유형 정의
const DOC_TYPES = ['전체', '규정', '운영방안', '지침', '가이드라인', '매뉴얼', '개발표준', '기술문서']

const TYPE_STYLE: Record<string, { bg: string; text: string; level: string }> = {
  규정:     { bg: 'bg-red-100',    text: 'text-red-700',    level: 'L1' },
  운영방안: { bg: 'bg-orange-100', text: 'text-orange-700', level: 'L1' },
  지침:     { bg: 'bg-blue-100',   text: 'text-blue-700',   level: 'L2' },
  가이드라인:{ bg: 'bg-green-100', text: 'text-green-700',  level: 'L3' },
  매뉴얼:   { bg: 'bg-purple-100', text: 'text-purple-700', level: 'L3' },
  개발표준: { bg: 'bg-teal-100',   text: 'text-teal-700',   level: 'L3' },
  기술문서: { bg: 'bg-gray-100',   text: 'text-gray-600',   level: 'L4' },
}

const SEC_STYLE: Record<string, string> = {
  G1: 'bg-blue-50 text-blue-600',
  G2: 'bg-orange-50 text-orange-600',
  G3: 'bg-red-50 text-red-600',
}

const STATUS_STYLE: Record<string, string> = {
  active:       'bg-green-100 text-green-700',
  draft:        'bg-yellow-100 text-yellow-700',
  deprecated:   'bg-gray-100 text-[var(--muted)]',
  unregistered: 'bg-gray-50 text-[var(--muted)]',
}

interface DocEntry {
  file: string; title: string; updatedAt: string; size: number
  registered: boolean; docId: string | null; type: string | null
  level: string | null; version: string | null; author: string | null
  approvedBy: string | null; approvedAt: string | null
  securityLevel: string | null; status: string; description: string | null; id: string | null
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-600 underline">$1</a>')
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactElement[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('# ')) {
      elements.push(<h1 key={elements.length} className="text-2xl font-bold text-gray-900 mt-6 mb-3 pb-2 border-b">{line.slice(2)}</h1>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={elements.length} className="text-xl font-bold text-gray-800 mt-5 mb-2">{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={elements.length} className="text-base font-semibold text-gray-700 mt-4 mb-1">{line.slice(4)}</h3>)
    } else if (line.startsWith('#### ')) {
      elements.push(<h4 key={elements.length} className="text-sm font-semibold text-gray-600 mt-3 mb-1">{line.slice(5)}</h4>)
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={elements.length} className="border-l-4 border-blue-400 pl-4 py-1 my-2 text-sm text-blue-700 bg-blue-50 rounded-r">
          {line.slice(2)}
        </blockquote>
      )
    } else if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      elements.push(
        <pre key={elements.length} className="bg-[var(--bg)] text-[var(--text)] rounded-lg p-4 text-xs overflow-x-auto my-3">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
    } else if (line.match(/^\|.+\|/)) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].match(/^\|/)) { tableLines.push(lines[i]); i++ }
      elements.push(
        <div key={elements.length} className="overflow-x-auto my-3">
          <table className="text-xs border-collapse w-full">
            <thead>
              {tableLines.filter((row, ri) => {
                const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1)
                return ri === 0 && !cells.every(c => c.trim().match(/^[-:]+$/))
              }).map((row, ri) => {
                const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1)
                return (
                  <tr key={ri} className="bg-gray-100">
                    {cells.map((cell, ci) => (
                      <th key={ci} className="px-3 py-1.5 text-left font-semibold text-gray-700 border border-gray-200">{cell.trim()}</th>
                    ))}
                  </tr>
                )
              })}
            </thead>
            <tbody>
              {tableLines.filter((row, ri) => {
                const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1)
                return ri > 0 && !cells.every(c => c.trim().match(/^[-:]+$/))
              }).map((row, ri) => {
                const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1)
                return (
                  <tr key={ri} className="border-t border-gray-100 hover:bg-gray-50">
                    {cells.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-gray-600 border border-gray-100" dangerouslySetInnerHTML={{ __html: renderInline(cell.trim()) }} />
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )
      continue
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) { items.push(lines[i].slice(2)); i++ }
      elements.push(
        <ul key={elements.length} className="list-disc list-inside space-y-0.5 text-sm text-gray-700 my-2 ml-2">
          {items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(it) }} />)}
        </ul>
      )
      continue
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, '')); i++ }
      elements.push(
        <ol key={elements.length} className="list-decimal list-inside space-y-0.5 text-sm text-gray-700 my-2 ml-2">
          {items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(it) }} />)}
        </ol>
      )
      continue
    } else if (line.startsWith('---')) {
      elements.push(<hr key={elements.length} className="border-gray-200 my-4" />)
    } else if (line.trim() === '') {
      elements.push(<div key={elements.length} className="h-2" />)
    } else {
      elements.push(
        <p key={elements.length} className="text-sm text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
      )
    }
    i++
  }
  return <>{elements}</>
}

export default function DocsPage() {
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('전체')
  const [selected, setSelected] = useState<DocEntry | null>(null)
  const [content, setContent] = useState('')
  const [contentLoading, setContentLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = typeFilter !== '전체' ? `?type=${encodeURIComponent(typeFilter)}` : ''
    fetch(`/api/governance-docs${params}`)
      .then(r => r.json())
      .then(d => { setDocs(d.docs ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [typeFilter])

  async function openDoc(doc: DocEntry) {
    setSelected(doc)
    setContentLoading(true)
    const res = await fetch(`/api/governance-docs?file=${encodeURIComponent(doc.file)}`)
    const data = await res.json()
    setContent(data.content ?? '')
    setContentLoading(false)
  }

  function formatSize(bytes: number) {
    return bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`
  }

  const registeredCount = docs.filter(d => d.registered).length
  const unregisteredCount = docs.filter(d => !d.registered).length

  return (
    <div className="flex h-[calc(100vh-48px)] gap-4">
      {/* 좌: 문서 목록 */}
      <div className="w-72 shrink-0 flex flex-col gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">거버넌스 문서</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {registeredCount}개 등록 · {unregisteredCount > 0 && <span className="text-orange-500">{unregisteredCount}개 미등록</span>}
          </p>
        </div>

        {/* 유형 필터 */}
        <div className="flex flex-wrap gap-1">
          {DOC_TYPES.map(t => {
            const style = TYPE_STYLE[t]
            return (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`text-xs px-2 py-1 rounded-full border transition ${
                  typeFilter === t
                    ? (style ? `${style.bg} ${style.text} border-transparent` : 'bg-[var(--surface)] text-white border-[var(--line)]')
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}>
                {t}
              </button>
            )
          })}
        </div>

        {/* 문서 목록 — 레벨별 그룹 */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {loading && <p className="text-sm text-[var(--muted)] text-center pt-4">로딩 중...</p>}
          {!loading && docs.length === 0 && (
            <p className="text-sm text-[var(--muted)] text-center pt-4">문서가 없습니다</p>
          )}
          {!loading && (() => {
            const LEVEL_LABELS: Record<string, string> = {
              L1: 'L1 — 규정',
              L2: 'L2 — 지침',
              L3: 'L3 — 가이드라인·매뉴얼',
              L4: 'L4 — 기술문서',
            }
            const elements: React.ReactElement[] = []
            let lastLevel = ''
            for (const doc of docs) {
              const lv = doc.level ?? (doc.registered ? '' : 'unregistered')
              // 그룹 헤더
              if (lv !== lastLevel) {
                lastLevel = lv
                const label = LEVEL_LABELS[lv] ?? (lv === 'unregistered' ? '미등록' : lv)
                elements.push(
                  <div key={`hdr-${lv}`} className="pt-3 pb-0.5 px-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
                    <div className="h-px bg-gray-100 mt-1" />
                  </div>
                )
              }
              const ts = doc.type ? TYPE_STYLE[doc.type] : null
              // 제목에서 [type]_ 접두사 제거해서 깔끔하게 표시
              const displayTitle = doc.title?.replace(/^\[[^\]]+\]_/, '') ?? doc.title
              elements.push(
                <button key={doc.file} onClick={() => openDoc(doc)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition ${
                    selected?.file === doc.file ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-300'
                  }`}>
                  {/* 고유번호 + 유형 */}
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    {doc.docId ? (
                      <span className="text-xs font-mono font-bold text-gray-700">{doc.docId}</span>
                    ) : (
                      <span className="text-xs text-orange-400 italic">미등록</span>
                    )}
                    {doc.type && ts && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${ts.bg} ${ts.text}`}>{doc.type}</span>
                    )}
                    {doc.securityLevel && (
                      <span className={`text-xs px-1 rounded ${SEC_STYLE[doc.securityLevel] ?? ''}`}>{doc.securityLevel}</span>
                    )}
                  </div>
                  {/* 제목 */}
                  <div className="text-sm font-medium text-gray-900 truncate">{displayTitle}</div>
                  {/* 버전 + 날짜 */}
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.version && <span className="text-xs text-[var(--muted)]">{doc.version}</span>}
                    <span className="text-xs text-[var(--muted)]">{new Date(doc.updatedAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                </button>
              )
            }
            return elements
          })()}
        </div>
      </div>

      {/* 우: 문서 내용 */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--muted)]">
            <div className="text-5xl mb-3">📄</div>
            <p className="text-sm">문서를 선택하면 내용이 표시됩니다</p>
            <p className="text-xs mt-1 text-[var(--text2)]">미등록 문서는 /admin/docs에서 메타데이터를 등록할 수 있습니다</p>
          </div>
        ) : contentLoading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-[var(--muted)]">불러오는 중...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 메타데이터 헤더 카드 */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {selected.docId && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-[var(--muted)] bg-gray-100 px-2 py-0.5 rounded">{selected.docId}</span>
                      {selected.type && (() => {
                        const ts = TYPE_STYLE[selected.type]
                        return ts ? <span className={`text-xs px-2 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>{selected.type} ({selected.level})</span> : null
                      })()}
                      {selected.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[selected.status] ?? ''}`}>
                          {selected.status === 'active' ? '✅ 현행' : selected.status === 'draft' ? '🔧 초안' : selected.status === 'deprecated' ? '📦 구버전' : '⚠️ 미등록'}
                        </span>
                      )}
                      {selected.securityLevel && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${SEC_STYLE[selected.securityLevel] ?? ''}`}>{selected.securityLevel}</span>
                      )}
                    </div>
                  )}
                  <h2 className="text-lg font-bold text-gray-900">{selected.title}</h2>
                  {selected.description && (
                    <p className="text-sm text-[var(--muted)] mt-1">{selected.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0 text-xs text-[var(--muted)] space-y-0.5">
                  {selected.version && <div>버전: <span className="font-medium text-gray-600">{selected.version}</span></div>}
                  {selected.author && <div>작성: {selected.author}</div>}
                  {selected.approvedBy && <div>승인: {selected.approvedBy}</div>}
                  {selected.approvedAt && (
                    <div>승인일: {new Date(selected.approvedAt).toLocaleDateString('ko-KR')}</div>
                  )}
                </div>
              </div>
              {!selected.registered && (
                <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-600">
                  ⚠️ 이 문서는 메타데이터가 미등록 상태입니다.
                  <a href="/admin/docs" className="ml-1 underline font-medium">Admin → 문서 관리</a>에서 고유번호와 유형을 등록해 주세요.
                </div>
              )}
            </div>

            {/* 본문 */}
            <div className="bg-white rounded-xl border p-8">
              <MarkdownRenderer content={content} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
