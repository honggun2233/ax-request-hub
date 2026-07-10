'use client'
import { useState, useEffect } from 'react'

const DEPRECATION_REASONS = ['DUPLICATE', 'PERFORMANCE', 'POLICY_CHANGE', 'SCOPE_CHANGE', 'OTHER']
const KPI_TYPES = [
  { value: 'ACCURACY', label: '정확도형' },
  { value: 'COMPLETION', label: '완료율형' },
  { value: 'TIME_SAVING', label: '시간절감형' },
  { value: 'SATISFACTION', label: '만족도형' },
]
const KPI_CYCLES = [
  { value: 'MONTHLY', label: '월별' },
  { value: 'QUARTERLY', label: '분기별' },
]

const FLAG_BADGE: Record<string, { label: string; cls: string }> = {
  WARNING: { label: 'WARNING', cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300' },
  RETIRE_CANDIDATE: { label: 'RETIRE 후보', cls: 'bg-red-100 text-red-800 border border-red-300' },
}

const EMPTY_FORM = {
  name: '',
  department: '',
  description: '',
  kpiName: '',
  kpiTarget: '',
  kpiType: '',
  kpiMeasureMethod: '',
  kpiMeasureCycle: 'MONTHLY',
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showDeprecate, setShowDeprecate] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [reason, setReason] = useState('')

  const load = () =>
    fetch('/api/admin/agents')
      .then(r => r.json())
      .then(d => setAgents(Array.isArray(d) ? d : []))
      .catch(() => {})

  useEffect(() => { load() }, [])

  const addAgent = async () => {
    await fetch('/api/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        kpiTarget: form.kpiTarget !== '' ? Number(form.kpiTarget) : undefined,
      }),
    })
    setShowAdd(false)
    setForm(EMPTY_FORM)
    load()
  }

  const deprecate = async (id: string) => {
    if (!reason) return
    await fetch(`/api/agents/${id}/deprecate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deprecationReason: reason }),
    })
    setShowDeprecate(null)
    setReason('')
    load()
  }

  const active = agents.filter(a => a.status === 'ACTIVE')
  const deprecated = agents.filter(a => a.status === 'DEPRECATED')

  const daysSince = (d: string) =>
    Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">에이전트 관리</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          + 에이전트 등록
        </button>
      </div>

      {/* 에이전트 등록 폼 */}
      {showAdd && (
        <div className="bg-white border rounded-lg p-5 space-y-4 max-w-xl">
          <h2 className="font-semibold text-sm">신규 에이전트 등록</h2>

          {/* 기본 정보 */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">기본 정보</p>
            <input
              placeholder="에이전트명 *"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              placeholder="부서 *"
              value={form.department}
              onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              placeholder="설명"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* KPI 섹션 */}
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">KPI 정의</p>
            <input
              placeholder="KPI 지표명 (예: 공시 분류 정확도)"
              value={form.kpiName}
              onChange={e => setForm(p => ({ ...p, kpiName: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="목표값 (%)"
                value={form.kpiTarget}
                onChange={e => setForm(p => ({ ...p, kpiTarget: e.target.value }))}
                className="w-1/2 border rounded px-3 py-2 text-sm"
                min={0}
                max={100}
                step={0.1}
              />
              <select
                value={form.kpiType}
                onChange={e => setForm(p => ({ ...p, kpiType: e.target.value }))}
                className="w-1/2 border rounded px-3 py-2 text-sm text-gray-700"
              >
                <option value="">KPI 유형 선택</option>
                {KPI_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="측정 방법 설명"
              value={form.kpiMeasureMethod}
              onChange={e => setForm(p => ({ ...p, kpiMeasureMethod: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
              rows={2}
            />
            <select
              value={form.kpiMeasureCycle}
              onChange={e => setForm(p => ({ ...p, kpiMeasureCycle: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm text-gray-700"
            >
              {KPI_CYCLES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={addAgent} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
              등록
            </button>
            <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }} className="px-4 py-2 border rounded text-sm">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 활성 에이전트 목록 */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-medium">활성 에이전트 ({active.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['이름', '부서', '설명', '최근 KPI 달성률', '미달 연속', '상태 플래그', '생성일', '액션'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">등록된 에이전트 없음</td>
              </tr>
            )}
            {active.map(a => {
              const flag = a.performanceFlag ? FLAG_BADGE[a.performanceFlag] : null
              return (
                <tr key={a.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{a.name}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{a.department}</td>
                  <td className="px-4 py-2 text-gray-500 truncate max-w-[160px]">{a.description || '-'}</td>
                  <td className="px-4 py-2 text-center whitespace-nowrap">
                    {a.kpiLastScore != null ? (
                      <span className={`font-semibold ${a.kpiLastScore >= 60 ? 'text-green-600' : 'text-red-500'}`}>
                        {a.kpiLastScore.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap">
                    {a.kpiMissCount > 0 ? (
                      <span className="text-orange-500 font-medium">{a.kpiMissCount}회</span>
                    ) : (
                      <span className="text-gray-300">0회</span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {flag ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${flag.cls}`}>
                        {flag.label}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setShowDeprecate(a.id)}
                      className="text-xs text-orange-600 hover:underline whitespace-nowrap"
                    >
                      폐기 시작
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 폐기 사유 모달 */}
      {showDeprecate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 space-y-4">
            <h2 className="font-semibold">폐기 사유 선택</h2>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">선택...</option>
              {DEPRECATION_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => deprecate(showDeprecate)}
                className="flex-1 bg-orange-500 text-white py-2 rounded text-sm"
              >
                폐기 시작
              </button>
              <button
                onClick={() => { setShowDeprecate(null); setReason('') }}
                className="flex-1 border py-2 rounded text-sm"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEPRECATED 에이전트 */}
      {deprecated.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium">DEPRECATED ({deprecated.length})</h3>
          </div>
          <div className="divide-y">
            {deprecated.map(a => {
              const days = a.deprecatedAt ? daysSince(a.deprecatedAt) : 0
              const canRetire = days >= 30
              return (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{a.name}</p>
                    <p className="text-xs text-gray-500">{a.deprecationReason} · 폐기 {days}일 경과</p>
                    {!canRetire && (
                      <p className="text-xs text-orange-500">RETIRE까지 {30 - days}일 남음</p>
                    )}
                  </div>
                  {canRetire && (
                    <button
                      className="text-xs text-gray-600 border px-3 py-1.5 rounded hover:bg-gray-50"
                      disabled
                    >
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
