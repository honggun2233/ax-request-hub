'use client'
import { useState, useEffect, useCallback } from 'react'

type Enrollment = { status: string; completedAt?: string | null; score?: number | null }
type Course = {
  id: string
  title: string
  level: string
  description: string
  durationMin: number
  isRequired: boolean
  isActive: boolean
  enrollments: Enrollment[]
}

const LEVEL_LABEL: Record<string, string> = { 기초: 'L1 기초', 중급: 'L2 중급', 고급: 'L3 고급' }

function CourseCard({ course, onAction }: { course: Course; onAction: (id: string, action: 'enroll' | 'complete') => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [acting, setActing] = useState(false)
  const enrollment = course.enrollments?.[0]
  const isCompleted = enrollment?.status === 'COMPLETED'
  const isInProgress = enrollment?.status === 'IN_PROGRESS'

  async function handleAction(action: 'enroll' | 'complete') {
    setActing(true)
    await onAction(course.id, action)
    setActing(false)
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden transition-shadow hover:shadow-sm">
      {/* Card header — clickable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-4 flex items-start justify-between gap-3 focus:outline-none"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{course.title}</span>
            {course.isRequired && (
              <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded font-medium">필수</span>
            )}
            {isCompleted && (
              <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-1.5 py-0.5 rounded font-medium">✓ 수료</span>
            )}
            {isInProgress && (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-medium">수강 중</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">소요시간 {course.durationMin}분</p>
        </div>
        <span className="text-gray-400 text-sm mt-0.5 flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          {/* Description */}
          <p className="text-sm text-gray-600">{course.description}</p>

          {/* Enrollment status */}
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
            <span className="text-gray-500">수강 상태: </span>
            {isCompleted ? (
              <span className="text-green-600 font-medium">
                수료 완료{enrollment?.completedAt ? ` (${new Date(enrollment.completedAt).toLocaleDateString('ko-KR')})` : ''}
                {enrollment?.score != null && ` · ${enrollment.score}점`}
              </span>
            ) : isInProgress ? (
              <span className="text-blue-600 font-medium">수강 진행 중</span>
            ) : (
              <span className="text-gray-400">미수강</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!isCompleted && !isInProgress && (
              <button
                onClick={() => handleAction('enroll')}
                disabled={acting}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {acting ? '처리 중…' : '수강 등록'}
              </button>
            )}
            {isInProgress && (
              <button
                onClick={() => handleAction('complete')}
                disabled={acting}
                className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
              >
                {acting ? '처리 중…' : '수강 완료 처리'}
              </button>
            )}
            {isCompleted && (
              <span className="text-sm text-gray-400 px-1">이미 수료한 과정입니다</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LiteracyPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [tab, setTab] = useState('기초')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/literacy')
      .then((r) => r.json())
      .then((d) => setCourses(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = courses.filter((c) => c.level === tab)
  const requiredCourses = courses.filter((c) => c.isRequired)
  const completed = requiredCourses.filter((c) => c.enrollments?.[0]?.status === 'COMPLETED').length
  const total = requiredCourses.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  async function handleAction(courseId: string, action: 'enroll' | 'complete') {
    await fetch('/api/literacy/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, action }),
    })
    load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">AI 리터러시 과정</h1>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">필수과정 수료율</span>
          <span className="text-sm font-bold text-blue-600">{pct}%</span>
        </div>
        <div className="bg-gray-100 rounded-full h-2.5">
          <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">{completed} / {total} 필수과정 수료 · 클릭하면 과정 상세 및 수강 등록</p>
      </div>

      {/* Level tabs */}
      <div className="flex border-b">
        {['기초', '중급', '고급'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {LEVEL_LABEL[t] ?? t}
          </button>
        ))}
      </div>

      {/* Course list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">이 레벨의 과정이 없습니다</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  )
}
