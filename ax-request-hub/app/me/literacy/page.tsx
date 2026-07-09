'use client'
import { useState, useEffect } from 'react'

export default function LiteracyPage() {
  const [courses, setCourses] = useState<any[]>([])
  const [tab, setTab] = useState('기초')
  useEffect(() => { fetch('/api/literacy').then(r => r.json()).then(d => setCourses(Array.isArray(d) ? d : [])).catch(() => {}) }, [])

  const filtered = courses.filter(c => c.level === tab)
  const total = courses.filter(c => c.isRequired).length
  const completed = courses.filter(c => c.isRequired && c.enrollments?.some((e: any) => e.status === 'COMPLETED')).length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">AI 리터러시 과정</h1>
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">필수과정 수료율</span>
          <span className="text-sm font-bold text-blue-600">{pct}%</span>
        </div>
        <div className="bg-gray-100 rounded-full h-2.5">
          <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">{completed} / {total} 필수과정 수료</p>
      </div>

      <div className="flex border-b">
        {['기초', '중급', '고급'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filtered.length === 0 && <p className="text-gray-400 text-sm">과정 없음</p>}
        {filtered.map(c => {
          const enrollment = c.enrollments?.[0]
          const done = enrollment?.status === 'COMPLETED'
          return (
            <div key={c.id} className="bg-white border rounded-lg p-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{c.title}</h3>
                  {c.isRequired && <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">필수</span>}
                  {done && <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">수료</span>}
                </div>
                <p className="text-sm text-gray-500 mt-1">{c.description}</p>
                <p className="text-xs text-gray-400 mt-1">소요시간: {c.durationMin}분</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
