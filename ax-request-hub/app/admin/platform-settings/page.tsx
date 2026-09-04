'use client'
import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

// ── 탭 정의 ─────────────────────────────────────────────
const TABS = ['리터러시 관리', '스킬 관리', '문서 관리'] as const
type Tab = typeof TABS[number]

// ── 리터러시 탭 ─────────────────────────────────────────
const LITERACY_STATUS_LABEL: Record<string, { text: string; color: string }> = {
  NOT_STARTED: { text: '미시작',   color: 'text-[var(--muted)] bg-gray-100' },
  IN_PROGRESS: { text: '수강 중',  color: 'text-blue-600 bg-blue-50' },
  COMPLETED:   { text: '수료',     color: 'text-green-600 bg-green-50' },
}

function LiteracyPanel() {
  const [courses, setCourses] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', level: '기초', description: '', durationMin: 60, isRequired: false })

  const load = () =>
    fetch('/api/admin/literacy')
      .then(r => r.json())
      .then(d => setCourses(Array.isArray(d) ? d : []))
      .catch(() => {})

  useEffect(() => { load() }, [])

  const addCourse = async () => {
    await fetch('/api/admin/literacy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowAdd(false)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">교육 관리</h2>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          + 과정 추가
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border rounded-lg p-4 space-y-3 max-w-md">
          <h3 className="font-semibold text-sm">신규 과정 추가</h3>
          <input placeholder="과정명" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
          <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
            {['기초', '중급', '고급'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <textarea placeholder="과정 설명" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full border rounded px-3 py-2 text-sm resize-none" />
          <input type="number" placeholder="소요시간(분)" value={form.durationMin} onChange={e => setForm(p => ({ ...p, durationMin: +e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isRequired} onChange={e => setForm(p => ({ ...p, isRequired: e.target.checked }))} />
            필수과정
          </label>
          <div className="flex gap-2">
            <button onClick={addCourse} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">추가</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded text-sm">취소</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-medium">과정 목록 ({courses.length}개)</h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">과정을 클릭하면 상세 내용과 수강 현황을 볼 수 있습니다.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['과정명', '레벨', '소요시간', '필수', '수강인원', '수료율'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs text-[var(--muted)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">과정 없음</td></tr>
            )}
            {courses.map(c => {
              const total = c.enrollments?.length ?? 0
              const done = c.enrollments?.filter((e: any) => e.status === 'COMPLETED').length ?? 0
              return (
                <tr key={c.id} className="border-t hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                  <td className="px-4 py-2 font-medium text-blue-700 hover:underline">{c.title}</td>
                  <td className="px-4 py-2 text-[var(--muted)]">{c.level}</td>
                  <td className="px-4 py-2">{c.durationMin}분</td>
                  <td className="px-4 py-2">
                    {c.isRequired ? <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">필수</span> : <span className="text-xs text-[var(--muted)]">선택</span>}
                  </td>
                  <td className="px-4 py-2">{total}명</td>
                  <td className="px-4 py-2">{total > 0 ? `${Math.round((done / total) * 100)}%` : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
          <div className="w-[480px] bg-white h-full shadow-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-base font-bold">{selected.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[var(--muted)]">{selected.level}</span>
                  <span className="text-[var(--text2)]">·</span>
                  <span className="text-xs text-[var(--muted)]">{selected.durationMin}분</span>
                  {selected.isRequired && <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">필수</span>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-[var(--muted)]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">과정 설명</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.description || '설명이 없습니다.'}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">수강 현황 ({selected.enrollments?.length ?? 0}명)</h3>
                {!selected.enrollments || selected.enrollments.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">수강자가 없습니다.</p>
                ) : (
                  <div className="space-y-1">
                    {selected.enrollments.map((e: any) => {
                      const s = LITERACY_STATUS_LABEL[e.status] ?? { text: e.status, color: 'text-[var(--muted)] bg-gray-100' }
                      return (
                        <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                          <div>
                            <p className="text-sm font-medium">{e.employee?.name ?? e.employeeId}</p>
                            <p className="text-xs text-[var(--muted)]">{e.employee?.email}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.text}</span>
                            {e.completedAt && <p className="text-xs text-[var(--muted)] mt-0.5">{new Date(e.completedAt).toLocaleDateString('ko-KR')} 수료</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 스킬 탭 ─────────────────────────────────────────────
const CATEGORIES = ['업무자동화', 'ETF운용', '리서치', '문서작성', '데이터분석', '기타']
const SEC_LEVELS = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL']
const SKILL_EMPTY_FORM = {
  skillId: '', name: '', category: '업무자동화', version: '1.0.0',
  author: '', securityLevel: 'PUBLIC', status: 'draft',
  purpose: '', instructions: '', promptText: '', examples: '', cautions: '',
}

function SkillsPanel() {
  const [skills, setSkills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...SKILL_EMPTY_FORM })
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/skills?status=all')
    const data = await res.json()
    setSkills(data.skills ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function resetForm() { setEditing(null); setForm({ ...SKILL_EMPTY_FORM }); setMsg('') }

  function startEdit(skill: any) {
    setEditing(skill.id)
    setForm({ skillId: skill.skillId, name: skill.name, category: skill.category, version: skill.version, author: skill.author, securityLevel: skill.securityLevel, status: skill.status, purpose: skill.purpose, instructions: skill.instructions, promptText: skill.promptText, examples: skill.examples, cautions: skill.cautions })
  }

  async function save() {
    if (!form.skillId || !form.name || !form.promptText) { setMsg('skillId, 이름, 프롬프트는 필수입니다'); return }
    setSaving(true)
    const res = await fetch('/api/skills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (res.ok) { setMsg(editing ? '수정 완료' : '등록 완료'); resetForm(); load() } else { setMsg(`오류: ${data.error}`) }
    setSaving(false)
  }

  async function approve(id: string) {
    await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'active' }) })
    load()
  }

  async function deprecate(id: string) {
    await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'deprecated' }) })
    load()
  }

  const filtered = filterStatus === 'all' ? skills : skills.filter(s => s.status === filterStatus)
  const STATUS_COLOR: Record<string, string> = { active: 'bg-green-100 text-green-700', draft: 'bg-yellow-100 text-yellow-700', deprecated: 'bg-gray-100 text-[var(--muted)]' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">AI 스킬 관리</h2>
        <button onClick={resetForm} className="text-sm bg-[#4A6FA5] text-white px-4 py-2 rounded hover:bg-[#1E3560]">+ 새 스킬 등록</button>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">{editing ? '스킬 편집' : '신규 스킬 등록'}</h3>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-[var(--muted)] block mb-1">Skill ID <span className="text-red-500">*</span></label><input value={form.skillId} onChange={e => setForm(f => ({ ...f, skillId: e.target.value }))} placeholder="skill-etf-nav-check" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
          <div><label className="text-xs text-[var(--muted)] block mb-1">이름 <span className="text-red-500">*</span></label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ETF NAV 점검" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
          <div><label className="text-xs text-[var(--muted)] block mb-1">버전</label><input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
          <div><label className="text-xs text-[var(--muted)] block mb-1">카테고리</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-[var(--muted)] block mb-1">보안 등급</label><select value={form.securityLevel} onChange={e => setForm(f => ({ ...f, securityLevel: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">{SEC_LEVELS.map(l => <option key={l}>{l}</option>)}</select></div>
          <div><label className="text-xs text-[var(--muted)] block mb-1">상태</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"><option value="draft">초안</option><option value="active">승인</option></select></div>
          <div className="col-span-3"><label className="text-xs text-[var(--muted)] block mb-1">작성자</label><input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="AX팀 홍길동" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
          <div className="col-span-3"><label className="text-xs text-[var(--muted)] block mb-1">목적</label><textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none" /></div>
          <div className="col-span-3"><label className="text-xs text-[var(--muted)] block mb-1">사용 방법</label><textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none" /></div>
          <div className="col-span-3"><label className="text-xs text-[var(--muted)] block mb-1">프롬프트 <span className="text-red-500">*</span></label><textarea value={form.promptText} onChange={e => setForm(f => ({ ...f, promptText: e.target.value }))} rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none font-mono" /></div>
          <div className="col-span-3"><label className="text-xs text-[var(--muted)] block mb-1">예시 입출력</label><textarea value={form.examples} onChange={e => setForm(f => ({ ...f, examples: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none" /></div>
          <div className="col-span-3"><label className="text-xs text-[var(--muted)] block mb-1">주의사항</label><textarea value={form.cautions} onChange={e => setForm(f => ({ ...f, cautions: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none" /></div>
        </div>
        {msg && <p className={`text-sm ${msg.startsWith('오류') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="text-sm bg-[#4A6FA5] text-white px-5 py-2 rounded hover:bg-[#1E3560] disabled:opacity-50">{saving ? '저장 중...' : editing ? '수정 저장' : '등록'}</button>
          {editing && <button onClick={resetForm} className="text-sm border border-gray-200 px-4 py-2 rounded-lg text-gray-600">취소</button>}
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="text-sm font-semibold text-gray-700">전체 스킬 ({skills.length}개)</span>
          <div className="flex gap-1">
            {['all', 'active', 'draft', 'deprecated'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`text-xs px-3 py-1 rounded-full border transition ${filterStatus === s ? 'bg-[#4A6FA5] text-white border-[#4A6FA5]' : 'border-[#E4E9F2] text-[var(--muted)]'}`}>
                {s === 'all' ? '전체' : s === 'active' ? '승인' : s === 'draft' ? '초안' : '폐기'}
              </button>
            ))}
          </div>
        </div>
        {loading && <p className="text-sm text-[var(--muted)] text-center py-8">로딩 중...</p>}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-[var(--muted)]">
            <tr>
              <th className="text-left px-4 py-2 font-medium">이름</th>
              <th className="text-left px-4 py-2 font-medium">카테고리</th>
              <th className="text-left px-4 py-2 font-medium">등급</th>
              <th className="text-left px-4 py-2 font-medium">상태</th>
              <th className="text-left px-4 py-2 font-medium">사용</th>
              <th className="text-left px-4 py-2 font-medium">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(skill => (
              <tr key={skill.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5"><div className="font-medium text-gray-900">{skill.name}</div><div className="text-xs text-[var(--muted)] font-mono">{skill.skillId}</div></td>
                <td className="px-4 py-2.5 text-gray-600">{skill.category}</td>
                <td className="px-4 py-2.5"><span className={`text-xs px-1.5 py-0.5 rounded ${skill.securityLevel === 'PUBLIC' ? 'bg-blue-50 text-blue-600' : skill.securityLevel === 'RESTRICTED' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>{skill.securityLevel}</span></td>
                <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[skill.status] ?? ''}`}>{skill.status === 'active' ? '✅ 승인' : skill.status === 'draft' ? '🔧 초안' : '📦 폐기'}</span></td>
                <td className="px-4 py-2.5 text-[var(--muted)]">{skill.usageCount}회</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <button onClick={() => startEdit(skill)} className="text-xs text-blue-600 hover:underline">편집</button>
                    {skill.status === 'draft' && <button onClick={() => approve(skill.id)} className="text-xs text-green-600 hover:underline">승인</button>}
                    {skill.status === 'active' && <button onClick={() => deprecate(skill.id)} className="text-xs text-[var(--muted)] hover:underline">폐기</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 문서 탭 ─────────────────────────────────────────────
const DOC_TYPES = ['규정', '운영방안', '지침', '가이드라인', '매뉴얼', '개발표준', '기술문서']
const DOC_LEVELS = ['L1', 'L2', 'L3', 'L4']
const DOC_SEC_LEVELS = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL']
const TYPE_CODE: Record<string, string> = { 규정: 'REG', 운영방안: 'OPS', 지침: 'GUI', 가이드라인: 'GDL', 매뉴얼: 'MAN', 개발표준: 'DEV', 기술문서: 'TEC' }
function suggestDocId(type: string, seq: string) { return `AX-${TYPE_CODE[type] ?? 'DOC'}-2026-${String(seq).padStart(3, '0')}` }

const DOC_EMPTY_FORM = { docId: '', fileName: '', type: '지침', level: 'L2', title: '', version: 'v1.0', author: 'AX팀', approvedBy: '', approvedAt: '', securityLevel: 'RESTRICTED', status: 'active', description: '' }

const TYPE_STYLE: Record<string, string> = { 규정: 'bg-red-100 text-red-700', 운영방안: 'bg-orange-100 text-orange-700', 지침: 'bg-blue-100 text-blue-700', 가이드라인: 'bg-green-100 text-green-700', 매뉴얼: 'bg-purple-100 text-purple-700', 개발표준: 'bg-teal-100 text-teal-700', 기술문서: 'bg-gray-100 text-gray-600' }

function DocsPanel() {
  const [files, setFiles] = useState<any[]>([])
  const [metas, setMetas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...DOC_EMPTY_FORM })
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

  function startEdit(meta: any) { setEditing(meta.id); setForm({ docId: meta.docId, fileName: meta.fileName, type: meta.type, level: meta.level, title: meta.title, version: meta.version, author: meta.author, approvedBy: meta.approvedBy, approvedAt: meta.approvedAt ? meta.approvedAt.slice(0, 10) : '', securityLevel: meta.securityLevel, status: meta.status, description: meta.description }) }
  function startRegister(file: any) { setEditing(null); setForm({ ...DOC_EMPTY_FORM, fileName: file.file, title: file.title || file.file.replace('.md', '') }); setMsg('') }
  function resetForm() { setEditing(null); setForm({ ...DOC_EMPTY_FORM }); setMsg('') }
  function onTypeChange(type: string) { const level = type === '규정' || type === '운영방안' ? 'L1' : type === '지침' ? 'L2' : 'L3'; setForm(f => ({ ...f, type, level, docId: suggestDocId(type, seq) })) }

  async function save() {
    if (!form.docId || !form.fileName || !form.type || !form.title) { setMsg('docId, fileName, type, title 필수'); return }
    setSaving(true)
    const res = await fetch('/api/governance-docs/meta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, approvedAt: form.approvedAt || null }) })
    const data = await res.json()
    if (res.ok) { setMsg(editing ? '수정 완료' : '등록 완료'); resetForm(); load() } else { setMsg(`오류: ${data.error}`) }
    setSaving(false)
  }

  const unregistered = files.filter(f => !f.registered)
  const registered = files.filter(f => f.registered)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">거버넌스 문서 관리</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">등록 {registered.length}개 · 미등록 {unregistered.length}개</p>
        </div>
        <button onClick={resetForm} className="text-sm bg-[#4A6FA5] text-white px-4 py-2 rounded hover:bg-[#1E3560]">+ 메타데이터 등록</button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">{editing ? '메타데이터 편집' : '신규 등록'}</h3>
          <div><label className="text-xs text-[var(--muted)] block mb-1">대상 파일 <span className="text-red-500">*</span></label><select value={form.fileName} onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"><option value="">-- 파일 선택 --</option>{files.map(f => <option key={f.file} value={f.file}>{f.registered ? '✅ ' : '⚠️ '}{f.file}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-[var(--muted)] block mb-1">문서 유형 <span className="text-red-500">*</span></label><select value={form.type} onChange={e => onTypeChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">{DOC_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="text-xs text-[var(--muted)] block mb-1">문서 레벨</label><select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">{DOC_LEVELS.map(l => <option key={l}>{l}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-[var(--muted)] block mb-1">고유번호 <span className="text-red-500">*</span></label><div className="flex gap-2"><input value={form.docId} onChange={e => setForm(f => ({ ...f, docId: e.target.value }))} placeholder={`AX-${TYPE_CODE[form.type] ?? 'REG'}-2026-001`} className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono" /><div className="flex items-center gap-1"><input value={seq} onChange={e => { setSeq(e.target.value); setForm(f => ({ ...f, docId: suggestDocId(f.type, e.target.value) })) }} className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center" placeholder="001" /><button onClick={() => setForm(f => ({ ...f, docId: suggestDocId(f.type, seq) }))} className="text-xs bg-gray-100 px-2 py-1.5 rounded-lg hover:bg-gray-200">자동</button></div></div></div>
          <div><label className="text-xs text-[var(--muted)] block mb-1">제목 <span className="text-red-500">*</span></label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-[var(--muted)] block mb-1">버전</label><input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
            <div><label className="text-xs text-[var(--muted)] block mb-1">보안 등급</label><select value={form.securityLevel} onChange={e => setForm(f => ({ ...f, securityLevel: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">{DOC_SEC_LEVELS.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-xs text-[var(--muted)] block mb-1">작성자</label><input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
            <div><label className="text-xs text-[var(--muted)] block mb-1">승인자</label><input value={form.approvedBy} onChange={e => setForm(f => ({ ...f, approvedBy: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
            <div><label className="text-xs text-[var(--muted)] block mb-1">승인일</label><input type="date" value={form.approvedAt} onChange={e => setForm(f => ({ ...f, approvedAt: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
            <div><label className="text-xs text-[var(--muted)] block mb-1">상태</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"><option value="active">현행</option><option value="draft">초안</option><option value="deprecated">구버전</option></select></div>
          </div>
          <div><label className="text-xs text-[var(--muted)] block mb-1">설명</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="이 문서의 목적과 적용 대상" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" /></div>
          {msg && <p className={`text-sm ${msg.startsWith('오류') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="text-sm bg-[#4A6FA5] text-white px-5 py-2 rounded hover:bg-[#1E3560] disabled:opacity-50">{saving ? '저장 중...' : editing ? '수정 저장' : '등록'}</button>
            {editing && <button onClick={resetForm} className="text-sm border border-gray-200 px-4 py-2 rounded-lg text-gray-600">취소</button>}
          </div>
        </div>

        <div className="space-y-4">
          {unregistered.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-orange-700 mb-2">⚠️ 메타데이터 미등록 ({unregistered.length}개)</h3>
              <div className="space-y-1.5">
                {unregistered.map((f: any) => (
                  <div key={f.file} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100">
                    <div><div className="text-xs text-gray-700 font-medium truncate max-w-[200px]">{f.title}</div><div className="text-xs text-[var(--muted)] font-mono truncate max-w-[200px]">{f.file}</div></div>
                    <button onClick={() => startRegister(f)} className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded-lg hover:bg-orange-600 shrink-0">등록</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50"><span className="text-sm font-semibold text-gray-700">등록 완료 ({registered.length}개)</span></div>
            <div className="divide-y divide-gray-50">
              {loading && <p className="text-sm text-[var(--muted)] text-center py-6">로딩 중...</p>}
              {metas.map((meta: any) => (
                <div key={meta.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-gray-600">{meta.docId}</span>
                      {meta.type && <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_STYLE[meta.type] ?? 'bg-gray-100 text-gray-600'}`}>{meta.type}</span>}
                      <span className="text-xs text-[var(--muted)]">{meta.level}</span>
                    </div>
                    <div className="text-sm text-gray-800 truncate">{meta.title}</div>
                    <div className="text-xs text-[var(--muted)] font-mono truncate">{meta.fileName}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[var(--muted)]">{meta.version}</span>
                    <button onClick={() => startEdit(meta)} className="text-xs text-blue-600 hover:underline">편집</button>
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

// ── 메인 페이지 ─────────────────────────────────────────
export default function PlatformSettingsPage() {
  const [activeTab, setActiveTab] = useState<number>(0)

  return (
    <div className="space-y-0">
      {/* 탭 헤더 */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === i
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-[var(--muted)] hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 0 && <LiteracyPanel />}
      {activeTab === 1 && <SkillsPanel />}
      {activeTab === 2 && <DocsPanel />}
    </div>
  )
}
