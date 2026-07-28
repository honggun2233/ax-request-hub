'use client'

import { useState, useEffect, useCallback } from 'react'

const CATEGORIES = ['업무자동화', 'ETF운용', '리서치', '문서작성', '데이터분석', '기타']
const SEC_LEVELS = ['G1', 'G2', 'G3']

const EMPTY_FORM = {
  skillId: '', name: '', category: '업무자동화', version: '1.0.0',
  author: '', securityLevel: 'G1', status: 'draft',
  purpose: '', instructions: '', promptText: '', examples: '', cautions: '',
}

interface Skill {
  id: string; skillId: string; name: string; category: string; status: string
  securityLevel: string; usageCount: number; author: string; version: string
  purpose: string; instructions: string; promptText: string; examples: string; cautions: string
  approvedBy: string; approvedAt: string | null
}

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...EMPTY_FORM })
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

  function startEdit(skill: Skill) {
    setEditing(skill.id)
    setForm({
      skillId: skill.skillId, name: skill.name, category: skill.category,
      version: skill.version, author: skill.author,
      securityLevel: skill.securityLevel, status: skill.status,
      purpose: skill.purpose, instructions: skill.instructions,
      promptText: skill.promptText, examples: skill.examples, cautions: skill.cautions,
    })
  }

  function resetForm() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setMsg('')
  }

  async function save() {
    if (!form.skillId || !form.name || !form.promptText) {
      setMsg('skillId, 이름, 프롬프트는 필수입니다')
      return
    }
    setSaving(true)
    const res = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
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

  async function approve(id: string) {
    await fetch('/api/skills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'active' }),
    })
    load()
  }

  async function deprecate(id: string) {
    await fetch('/api/skills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'deprecated' }),
    })
    load()
  }

  const filtered = filterStatus === 'all' ? skills : skills.filter(s => s.status === filterStatus)

  const STATUS_COLOR: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    draft: 'bg-yellow-100 text-yellow-700',
    deprecated: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">AI 스킬 관리</h1>
        <button onClick={resetForm} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + 새 스킬 등록
        </button>
      </div>

      {/* 등록/편집 폼 */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">{editing ? '스킬 편집' : '신규 스킬 등록'}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Skill ID <span className="text-red-500">*</span></label>
            <input value={form.skillId} onChange={e => setForm(f => ({ ...f, skillId: e.target.value }))}
              placeholder="skill-etf-nav-check"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">이름 <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ETF NAV 점검"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">버전</label>
            <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">카테고리</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">보안 등급</label>
            <select value={form.securityLevel} onChange={e => setForm(f => ({ ...f, securityLevel: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              {SEC_LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">상태</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="draft">초안</option>
              <option value="active">승인</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="text-xs text-gray-500 block mb-1">작성자</label>
            <input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
              placeholder="AX팀 홍길동"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-gray-500 block mb-1">목적</label>
            <textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              rows={2} placeholder="이 스킬의 목적 및 활용 대상"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-gray-500 block mb-1">사용 방법</label>
            <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              rows={2} placeholder="단계별 사용 방법 설명"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-gray-500 block mb-1">프롬프트 <span className="text-red-500">*</span></label>
            <textarea value={form.promptText} onChange={e => setForm(f => ({ ...f, promptText: e.target.value }))}
              rows={6} placeholder="Claude에게 붙여넣을 프롬프트 전문"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none font-mono" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-gray-500 block mb-1">예시 입출력</label>
            <textarea value={form.examples} onChange={e => setForm(f => ({ ...f, examples: e.target.value }))}
              rows={3} placeholder="입력: ... / 출력: ..."
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-gray-500 block mb-1">주의사항</label>
            <textarea value={form.cautions} onChange={e => setForm(f => ({ ...f, cautions: e.target.value }))}
              rows={2} placeholder="민감 정보 입력 금지, 결과 검토 필수 등"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none" />
          </div>
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

      {/* 스킬 목록 */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="text-sm font-semibold text-gray-700">전체 스킬 ({skills.length}개)</span>
          <div className="flex gap-1">
            {['all', 'active', 'draft', 'deprecated'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1 rounded-full border transition ${
                  filterStatus === s ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600'
                }`}>
                {s === 'all' ? '전체' : s === 'active' ? '승인' : s === 'draft' ? '초안' : '폐기'}
              </button>
            ))}
          </div>
        </div>
        {loading && <p className="text-sm text-gray-400 text-center py-8">로딩 중...</p>}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
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
                <td className="px-4 py-2.5">
                  <div className="font-medium text-gray-900">{skill.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{skill.skillId}</div>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{skill.category}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    skill.securityLevel === 'G1' ? 'bg-blue-50 text-blue-600' :
                    skill.securityLevel === 'G2' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
                  }`}>{skill.securityLevel}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[skill.status] ?? ''}`}>
                    {skill.status === 'active' ? '✅ 승인' : skill.status === 'draft' ? '🔧 초안' : '📦 폐기'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{skill.usageCount}회</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <button onClick={() => startEdit(skill)}
                      className="text-xs text-blue-600 hover:underline">편집</button>
                    {skill.status === 'draft' && (
                      <button onClick={() => approve(skill.id)}
                        className="text-xs text-green-600 hover:underline">승인</button>
                    )}
                    {skill.status === 'active' && (
                      <button onClick={() => deprecate(skill.id)}
                        className="text-xs text-gray-400 hover:underline">폐기</button>
                    )}
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
