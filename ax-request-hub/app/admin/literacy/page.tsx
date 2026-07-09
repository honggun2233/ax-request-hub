'use client'
import { useState, useEffect } from 'react'

export default function AdminLiteracyPage() {
  const [courses, setCourses] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', level: '기초', description: '', durationMin: 60, isRequired: false })

  const load = () => fetch('/api/admin/literacy').then(r => r.json()).then(d => setCourses(Array.isArray(d) ? d : [])).catch(() => {})
  useEffect(() => { load() }, [])

  const addCourse = async () => {
    await fetch('/api/admin/literacy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setShowAdd(false); load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">리터러시 관리</h1>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">+ 과정 추가</button>
      </div>
      {showAdd && (
        <div className="bg-white border rounded-lg p-4 space-y-3 max-w-md">
          <h2 className="font-semibold text-sm">신규 과정 추가</h2>
          <input placeholder="과정명" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
          <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm">
            {['기초', '중급', '고급'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input placeholder="설명" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
          <input type="number" placeholder="소요시간(분)" value={form.durationMin} onChange={e => setForm(p => ({ ...p, durationMin: +e.target.value }))} className="w-full border rounded px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isRequired} onChange={e => setForm(p => ({ ...p, isRequired: e.target.checked }))} /> 필수과정</label>
          <div className="flex gap-2">
            <button onClick={addCourse} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">추가</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border rounded text-sm">취소</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b"><h3 className="text-sm font-medium">과정 목록 ({courses.length}개)</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{['과정명', '레벨', '소요시간', '필수', '수강인원', '수료율'].map(h => <th key={h} className="px-4 py-2 text-left text-xs text-gray-500">{h}</th>)}</tr></thead>
          <tbody>
            {courses.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">과정 없음</td></tr>}
            {courses.map(c => {
              const total = c.enrollments?.length ?? 0
              const done = c.enrollments?.filter((e: any) => e.status === 'COMPLETED').length ?? 0
              return (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{c.title}</td>
                  <td className="px-4 py-2 text-gray-500">{c.level}</td>
                  <td className="px-4 py-2">{c.durationMin}분</td>
                  <td className="px-4 py-2">{c.isRequired ? <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">필수</span> : '-'}</td>
                  <td className="px-4 py-2">{total}명</td>
                  <td className="px-4 py-2">{total > 0 ? `${Math.round((done / total) * 100)}%` : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
