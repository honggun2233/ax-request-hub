'use client'
import { useState, useEffect } from 'react'

const DEPRECATION_REASONS = ['DUPLICATE', 'PERFORMANCE', 'POLICY_CHANGE', 'SCOPE_CHANGE', 'OTHER']

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showDeprecate, setShowDeprecate] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', department: '', description: '' })
  const [reason, setReason] = useState('')

  const load = () => fetch('/api/admin/agents').then(r => r.json()).then(d => setAgents(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const addAgent = async () => {
    await fetch('/api/admin/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowAdd(false); setForm({ name: '', department: '', description: '' }); load()
  }

  const deprecate = async (id: string) => {
    if (!reason) return
    await fetch(`/api/agents/${id}/deprecate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deprecationReason: reason }) })
    setShowDeprecate(null); setReason(''); load()
  }

  const active = agents.filter(a => a.status === 'ACTIVE')
  const deprecated = agents.filter(a => a.status === 'DEPRECATED')

  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">에이전트 관리</h1>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">+ 에이전트 등록</button>
      </div>

      {showAdd && (
        <div className="bg-white border rounded-lg p-4 space-y-3 max-w-md">
          <h2 className="font-semibold text-sm">신규 에이전트 등록</h2>
          {(['name', 'department', 'description'] as const).map(f => (
            <input key={f} placeholder={f === 'name' ? '에이전트명' : f === 'department' ? '부서' : '설명'}
              value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm" />
          ))}
          <div className="flex gap-2">
            <button onClick={addAgent} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">등록</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded text-sm">취소</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b"><h3 className="text-sm font-medium">활성 에이전트 ({active.length})</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{['이름', '부서', '설명', '생성일', '액션'].map(h => <th key={h} className="px-4 py-2 text-left text-xs text-gray-500">{h}</th>)}</tr></thead>
          <tbody>
            {active.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">등록된 에이전트 없음</td></tr>}
            {active.map(a => (
              <tr key={a.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{a.name}</td>
                <td className="px-4 py-2 text-gray-500">{a.department}</td>
                <td className="px-4 py-2 text-gray-500 truncate max-w-[200px]">{a.description || '-'}</td>
                <td className="px-4 py-2 text-gray-400">{new Date(a.createdAt).toLocaleDateString('ko-KR')}</td>
                <td className="px-4 py-2">
                  <button onClick={() => setShowDeprecate(a.id)} className="text-xs text-orange-600 hover:underline">폐기 시작</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDeprecate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 space-y-4">
            <h2 className="font-semibold">폐기 사유 선택</h2>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="">선택...</option>
              {DEPRECATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => deprecate(showDeprecate)} className="flex-1 bg-orange-500 text-white py-2 rounded text-sm">폐기 시작</button>
              <button onClick={() => { setShowDeprecate(null); setReason('') }} className="flex-1 border py-2 rounded text-sm">취소</button>
            </div>
          </div>
        </div>
      )}

      {deprecated.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b"><h3 className="text-sm font-medium">DEPRECATED ({deprecated.length})</h3></div>
          <div className="divide-y">
            {deprecated.map(a => {
              const days = a.deprecatedAt ? daysSince(a.deprecatedAt) : 0
              const canRetire = days >= 30
              return (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{a.name}</p>
                    <p className="text-xs text-gray-500">{a.deprecationReason} · 폐기 {days}일 경과</p>
                    {!canRetire && <p className="text-xs text-orange-500">RETIRE까지 {30 - days}일 남음</p>}
                  </div>
                  {canRetire && (
                    <button className="text-xs text-gray-600 border px-3 py-1.5 rounded hover:bg-gray-50" disabled>
                      지식 추출 후 RETIRE
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
