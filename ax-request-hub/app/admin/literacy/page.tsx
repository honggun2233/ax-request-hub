'use client'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  NOT_STARTED: { text: '미시작',   color: 'text-gray-500 bg-gray-100' },
  IN_PROGRESS: { text: '수강 중',  color: 'text-blue-600 bg-blue-50' },
  COMPLETED:   { text: '수료',     color: 'text-green-600 bg-green-50' },
}

export default function AdminLiteracyPage() {
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
        <h1 className="text-xl font-bold">리터러시 관리</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          + 과정 추가
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border rounded-lg p-4 space-y-3 max-w-md">
          <h2 className="font-semibold text-sm">신규 과정 추가</h2>
          <input
            placeholder="과정명"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <select
            value={form.level}
            onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {['기초', '중급', '고급'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <textarea
            placeholder="과정 설명"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={3}
            className="w-full border rounded px-3 py-2 text-sm resize-none"
          />
          <input
            type="number"
            placeholder="소요시간(분)"
            value={form.durationMin}
            onChange={e => setForm(p => ({ ...p, durationMin: +e.target.value }))}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={e => setForm(p => ({ ...p, isRequired: e.target.checked }))}
            />
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
          <p className="text-xs text-gray-400 mt-0.5">과정을 클릭하면 상세 내용과 수강 현황을 볼 수 있습니다.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['과정명', '레벨', '소요시간', '필수', '수강인원', '수료율'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">과정 없음</td></tr>
            )}
            {courses.map(c => {
              const total = c.enrollments?.length ?? 0
              const done = c.enrollments?.filter((e: any) => e.status === 'COMPLETED').length ?? 0
              return (
                <tr
                  key={c.id}
                  className="border-t hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => setSelected(c)}
                >
                  <td className="px-4 py-2 font-medium text-blue-700 hover:underline">{c.title}</td>
                  <td className="px-4 py-2 text-gray-500">{c.level}</td>
                  <td className="px-4 py-2">{c.durationMin}분</td>
                  <td className="px-4 py-2">
                    {c.isRequired
                      ? <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">필수</span>
                      : <span className="text-xs text-gray-400">선택</span>}
                  </td>
                  <td className="px-4 py-2">{total}명</td>
                  <td className="px-4 py-2">{total > 0 ? `${Math.round((done / total) * 100)}%` : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 과정 상세 슬라이드 패널 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          {/* 배경 */}
          <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
          {/* 패널 */}
          <div className="w-[480px] bg-white h-full shadow-xl flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-base font-bold">{selected.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{selected.level}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{selected.durationMin}분</span>
                  {selected.isRequired && (
                    <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">필수</span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* 과정 설명 */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">과정 설명</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selected.description || '설명이 없습니다.'}
                </p>
              </div>

              {/* 수강 현황 */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  수강 현황 ({selected.enrollments?.length ?? 0}명)
                </h3>
                {!selected.enrollments || selected.enrollments.length === 0 ? (
                  <p className="text-sm text-gray-400">수강자가 없습니다.</p>
                ) : (
                  <div className="space-y-1">
                    {selected.enrollments.map((e: any) => {
                      const s = STATUS_LABEL[e.status] ?? { text: e.status, color: 'text-gray-500 bg-gray-100' }
                      return (
                        <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                          <div>
                            <p className="text-sm font-medium">{e.employee?.name ?? e.employeeId}</p>
                            <p className="text-xs text-gray-400">{e.employee?.email}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.text}</span>
                            {e.completedAt && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(e.completedAt).toLocaleDateString('ko-KR')} 수료
                              </p>
                            )}
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
