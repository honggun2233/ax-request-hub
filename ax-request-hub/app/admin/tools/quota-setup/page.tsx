'use client'

import { useEffect, useState } from 'react'

const TOOL_LABEL: Record<string, string> = {
  GPT_CHAT: 'ChatGPT (Chat)',
  GPT_EXCEL: 'ChatGPT (Excel)',
  GEMINI: 'Gemini Enterprise',
}

const AI_DENSITY_LABEL: Record<string, string> = {
  HIGH: '높음 (AI 집약)',
  MEDIUM: '중간',
  STANDARD: '기본',
}

interface Quota {
  id: string
  department: string
  toolType: string
  totalQuota: number
  aiDensity: string
  managedBy: string
  usedCount: number
}

export default function QuotaSetupPage() {
  const [quotas, setQuotas] = useState<Quota[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ totalQuota: 0, managedBy: '', aiDensity: 'STANDARD' })

  // 신규 쿼터 폼
  const [newForm, setNewForm] = useState({
    department: '',
    toolType: 'GPT_CHAT',
    totalQuota: 10,
    aiDensity: 'STANDARD',
    managedBy: '',
  })

  async function loadQuotas() {
    setLoading(true)
    const res = await fetch('/api/admin/tools/quota')
    const data = await res.json()
    setQuotas(data.quotas ?? [])
    setLoading(false)
  }

  useEffect(() => { loadQuotas() }, [])

  async function handleEdit(quota: Quota) {
    setEditing(quota.id)
    setEditForm({ totalQuota: quota.totalQuota, managedBy: quota.managedBy, aiDensity: quota.aiDensity })
  }

  async function handleSaveEdit(id: string) {
    const res = await fetch('/api/admin/tools/quota', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm }),
    })
    if (res.ok) {
      setEditing(null)
      loadQuotas()
    } else {
      const d = await res.json()
      alert(d.error ?? '수정 실패')
    }
  }

  async function handleCreate() {
    if (!newForm.department.trim()) { alert('부서명을 입력하세요'); return }
    if (!newForm.managedBy.trim()) { alert('부서장 이메일을 입력하세요'); return }
    const res = await fetch('/api/admin/tools/quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    if (res.ok) {
      setNewForm({ department: '', toolType: 'GPT_CHAT', totalQuota: 10, aiDensity: 'STANDARD', managedBy: '' })
      loadQuotas()
    } else {
      const d = await res.json()
      alert(d.error ?? '생성 실패')
    }
  }

  const totalAllocated = quotas.reduce((s, q) => s + q.totalQuota, 0)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <a href="/admin/tools" className="text-sm text-gray-400 hover:text-gray-600">← AI 도구 관리</a>
        </div>
        <h1 className="text-2xl font-bold mb-1">부서별 쿼터 설정</h1>
        <p className="text-sm text-gray-500 mb-8">
          AI 도구 계정 쿼터를 부서별로 설정하고 부서장(관리 위임자)을 지정합니다.
          총 배분: <strong>{totalAllocated}석</strong> / 계약 한도: 200석
        </p>

        {/* 총 게이지 */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">전체 배분 현황</span>
            <span className={`text-sm font-bold ${totalAllocated > 200 ? 'text-red-500' : 'text-green-600'}`}>
              {totalAllocated} / 200석
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${totalAllocated > 200 ? 'bg-red-500' : totalAllocated > 160 ? 'bg-yellow-400' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, (totalAllocated / 200) * 100)}%` }}
            />
          </div>
        </div>

        {/* 쿼터 목록 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">부서</th>
                <th className="text-left p-4 font-medium text-gray-600">도구</th>
                <th className="text-left p-4 font-medium text-gray-600">쿼터</th>
                <th className="text-left p-4 font-medium text-gray-600">사용</th>
                <th className="text-left p-4 font-medium text-gray-600">AI 밀도</th>
                <th className="text-left p-4 font-medium text-gray-600">부서장 이메일</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">로딩 중...</td></tr>
              )}
              {!loading && quotas.map(q => (
                <tr key={q.id}>
                  <td className="p-4 font-medium">{q.department}</td>
                  <td className="p-4 text-gray-600">{TOOL_LABEL[q.toolType] ?? q.toolType}</td>
                  <td className="p-4">
                    {editing === q.id ? (
                      <input
                        type="number"
                        value={editForm.totalQuota}
                        onChange={e => setEditForm(f => ({ ...f, totalQuota: Number(e.target.value) }))}
                        className="w-16 border border-gray-200 rounded px-2 py-1 text-sm"
                        min={0}
                      />
                    ) : `${q.totalQuota}석`}
                  </td>
                  <td className="p-4 text-gray-500">{q.usedCount}석</td>
                  <td className="p-4">
                    {editing === q.id ? (
                      <select
                        value={editForm.aiDensity}
                        onChange={e => setEditForm(f => ({ ...f, aiDensity: e.target.value }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm"
                      >
                        {Object.entries(AI_DENSITY_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-500">{AI_DENSITY_LABEL[q.aiDensity] ?? q.aiDensity}</span>
                    )}
                  </td>
                  <td className="p-4">
                    {editing === q.id ? (
                      <input
                        type="email"
                        value={editForm.managedBy}
                        onChange={e => setEditForm(f => ({ ...f, managedBy: e.target.value }))}
                        className="w-48 border border-gray-200 rounded px-2 py-1 text-sm"
                        placeholder="dept-head@samsung.com"
                      />
                    ) : (
                      <span className="text-xs text-gray-500">{q.managedBy || '미지정'}</span>
                    )}
                  </td>
                  <td className="p-4">
                    {editing === q.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(q.id)}
                          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                        >저장</button>
                        <button
                          onClick={() => setEditing(null)}
                          className="text-xs text-gray-500 hover:underline"
                        >취소</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(q)}
                        className="text-xs text-blue-600 hover:underline"
                      >수정</button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && quotas.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">등록된 쿼터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 신규 쿼터 추가 */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">새 쿼터 추가</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">부서명</label>
              <input
                type="text"
                value={newForm.department}
                onChange={e => setNewForm(f => ({ ...f, department: e.target.value }))}
                placeholder="운용본부"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">도구</label>
              <select
                value={newForm.toolType}
                onChange={e => setNewForm(f => ({ ...f, toolType: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(TOOL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">쿼터 (석)</label>
              <input
                type="number"
                value={newForm.totalQuota}
                onChange={e => setNewForm(f => ({ ...f, totalQuota: Number(e.target.value) }))}
                min={1}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">AI 밀도</label>
              <select
                value={newForm.aiDensity}
                onChange={e => setNewForm(f => ({ ...f, aiDensity: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(AI_DENSITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">부서장 이메일</label>
              <input
                type="email"
                value={newForm.managedBy}
                onChange={e => setNewForm(f => ({ ...f, managedBy: e.target.value }))}
                placeholder="dept-head@samsung.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="mt-4 bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-blue-700 transition"
          >
            쿼터 추가
          </button>
        </div>
      </div>
    </div>
  )
}
