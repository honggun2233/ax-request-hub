'use client'

import { useState, useEffect, useCallback } from 'react'

const DOC_TYPES = ['규정', '운영방안', '지침', '가이드라인', '매뉴얼', '개발표준', '기술문서']
const LEVELS = ['L1', 'L2', 'L3', 'L4']
const SEC_LEVELS = ['G1', 'G2', 'G3']

// docId 자동 생성 헬퍼
const TYPE_CODE: Record<string, string> = {
  규정: 'REG', 운영방안: 'OPS', 지침: 'GUI', 가이드라인: 'GDL',
  매뉴얼: 'MAN', 개발표준: 'DEV', 기술문서: 'TEC',
}
function suggestDocId(type: string, seq: string) {
  const code = TYPE_CODE[type] ?? 'DOC'
  return `AX-${code}-2026-${String(seq).padStart(3, '0')}`
}

const EMPTY_FORM = {
  docId: '', fileName: '', type: '지침', level: 'L2', title: '',
  version: 'v1.0', author: 'AX팀', approvedBy: '', approvedAt: '',
  securityLevel: 'G2', status: 'active', description: '',
}

interface DocMeta {
  id: string; docId: string; fileName: string; type: string; level: string; title: string
  version: string; author: string; approvedBy: string; approvedAt: string | null
  securityLevel: string; status: string; description: string
}

interface FileEntry {
  file: string; title: string; registered: boolean; docId: string | null; type: string | null
  version: string | null; status: string
}

export default function AdminDocsPage() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [metas, setMetas] = useState<DocMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [seq, setSeq] = useState('001')

  const load = useCallback(async () => {
    setLoading(true)
    const [filesRes, metaRes] = await Promise.all([
      fetch('/api/governance-docs').then(r => r.json()),
      fetch('/api/governance-docs/meta').then(r => r.json()),
    ])
    setFiles(filesRes.docs ?? [])
    setMetas(metaRes.docs ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(meta: DocMeta) {
    setEditing(meta.id)
    setForm({
      docId: meta.docId, fileName: meta.fileName, type: meta.type, level: meta.level,
      title: meta.title, version: meta.version, author: meta.author,
      approvedBy: meta.approvedBy,
      approvedAt: meta.approvedAt ? meta.approvedAt.slice(0, 10) : '',
      securityLevel: meta.securityLevel, status: meta.status, description: meta.description,
    })
  }

  function startRegister(file: FileEntry) {
    setEditing(null)
    // 파일명에서 제목 추론
    const guessTitle = file.title || file.file.replace('.md', '')
    setForm({ ...EMPTY_FORM, fileName: file.file, title: guessTitle })
    setMsg('')
  }

  function resetForm() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setMsg('')
  }

  // 유형 변경 시 docId 자동 제안
  function onTypeChange(type: string) {
    const level = type === '규정' || type === '운영방안' ? 'L1'
      : type === '지침' ? 'L2'
      : 'L3'
    setForm(f => ({ ...f, type, level, docId: suggestDocId(type, seq) }))
  }

  async function save() {
    if (!form.docId || !form.fileName || !form.type || !form.title) {
      setMsg('docId, fileName, type, title 필수')
      return
    }
    setSaving(true)
    const res = await fetch('/api/governance-docs/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, approvedAt: form.approvedAt || null }),
    })
    const data = await res.json()
    if (res.ok) {
      setMsg(editing ? '수정 완료' : '등록 완료')
      resetForm()
      load()
    } else {
      setMsg(`오류: ${data.error}`)
    }
    setSaving(false)
  }

  const TYPE_STYLE: Record<string, string> = {
    규정: 'bg-red-100 text-red-700', 운영방안: 'bg-orange-100 text-orange-700',
    지침: 'bg-blue-100 text-blue-700', 가이드라인: 'bg-green-100 text-green-700',
    매뉴얼: 'bg-purple-100 text-purple-700', 개발표준: 'bg-teal-100 text-teal-700',
    기술문서: 'bg-gray-100 text-gray-600',
  }

  const unregistered = files.filter(f => !f.registered)
  const registered = files.filter(f => f.registered)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">거버넌스 문서 관리</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">등록 {registered.length}개 · 미등록 {unregistered.length}개</p>
        </div>
        <button onClick={resetForm} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + 메타데이터 등록
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 좌: 등록/편집 폼 */}
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">{editing ? '메타데이터 편집' : '신규 등록'}</h2>

          {/* 파일 선택 */}
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">대상 파일 <span className="text-red-500">*</span></label>
            <select value={form.fileName} onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="">-- 파일 선택 --</option>
              {files.map(f => (
                <option key={f.file} value={f.file}>
                  {f.registered ? '✅ ' : '⚠️ '}{f.file}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 유형 */}
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">문서 유형 <span className="text-red-500">*</span></label>
              <select value={form.type} onChange={e => onTypeChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {/* 레벨 */}
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">문서 레벨</label>
              <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                {LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* 고유번호 */}
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">
              고유번호 <span className="text-red-500">*</span>
              <span className="ml-2 text-[var(--muted)] normal-case">형식: AX-{TYPE_CODE[form.type] ?? 'REG'}-YYYY-NNN</span>
            </label>
            <div className="flex gap-2">
              <input value={form.docId} onChange={e => setForm(f => ({ ...f, docId: e.target.value }))}
                placeholder={`AX-${TYPE_CODE[form.type] ?? 'REG'}-2026-001`}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono" />
              <div className="flex items-center gap-1">
                <input value={seq} onChange={e => { setSeq(e.target.value); setForm(f => ({ ...f, docId: suggestDocId(f.type, e.target.value) })) }}
                  className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center"
                  placeholder="001" />
                <button onClick={() => setForm(f => ({ ...f, docId: suggestDocId(f.type, seq) }))}
                  className="text-xs bg-gray-100 px-2 py-1.5 rounded-lg hover:bg-gray-200">자동</button>
              </div>
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">제목 <span className="text-red-500">*</span></label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">버전</label>
              <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">보안 등급</label>
              <select value={form.securityLevel} onChange={e => setForm(f => ({ ...f, securityLevel: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                {SEC_LEVELS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">작성자</label>
              <input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">승인자</label>
              <input value={form.approvedBy} onChange={e => setForm(f => ({ ...f, approvedBy: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">승인일</label>
              <input type="date" value={form.approvedAt} onChange={e => setForm(f => ({ ...f, approvedAt: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">상태</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                <option value="active">현행</option>
                <option value="draft">초안</option>
                <option value="deprecated">구버전</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--muted)] block mb-1">설명 (한 줄 요약)</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="이 문서의 목적과 적용 대상"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>

          {msg && <p className={`text-sm ${msg.startsWith('오류') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? '저장 중...' : editing ? '수정 저장' : '등록'}
            </button>
            {editing && <button onClick={resetForm} className="text-sm border border-gray-200 px-4 py-2 rounded-lg text-gray-600">취소</button>}
          </div>
        </div>

        {/* 우: 파일 목록 */}
        <div className="space-y-4">
          {/* 미등록 */}
          {unregistered.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-orange-700 mb-2">⚠️ 메타데이터 미등록 ({unregistered.length}개)</h3>
              <div className="space-y-1.5">
                {unregistered.map(f => (
                  <div key={f.file} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100">
                    <div>
                      <div className="text-xs text-gray-700 font-medium truncate max-w-[200px]">{f.title}</div>
                      <div className="text-xs text-[var(--muted)] font-mono truncate max-w-[200px]">{f.file}</div>
                    </div>
                    <button onClick={() => startRegister(f)}
                      className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded-lg hover:bg-orange-600 shrink-0">
                      등록
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 등록됨 */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">등록 완료 ({registered.length}개)</span>
            </div>
            <div className="divide-y divide-gray-50">
              {loading && <p className="text-sm text-[var(--muted)] text-center py-6">로딩 중...</p>}
              {metas.map(meta => (
                <div key={meta.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-gray-600">{meta.docId}</span>
                      {meta.type && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_STYLE[meta.type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {meta.type}
                        </span>
                      )}
                      <span className="text-xs text-[var(--muted)]">{meta.level}</span>
                    </div>
                    <div className="text-sm text-gray-800 truncate">{meta.title}</div>
                    <div className="text-xs text-[var(--muted)] font-mono truncate">{meta.fileName}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[var(--muted)]">{meta.version}</span>
                    <button onClick={() => startEdit(meta)}
                      className="text-xs text-blue-600 hover:underline">편집</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
