'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProjectFormData {
  id: string
  title: string
  department: string
  requesterName: string
  requesterEmail: string
  description: string
  asIs: string
  expectedBenefit: string
  confidentialityLevel: 'G1' | 'G2' | 'G3'
  championName: string
  estimatedUsers: number
}

export function ProjectForm({ initialData }: { initialData: ProjectFormData }) {
  const [data, setData] = useState(initialData)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await fetch(`/api/projects/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      await fetch(`/api/evaluate/${data.id}`, { method: 'POST' })
      router.push(`/status/${data.id}`)
    } catch {
      setError('제출 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">과제명</label>
        <input type="text" value={data.title}
          onChange={(e) => setData({ ...data, title: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">신청 부서</label>
        <input type="text" value={data.department}
          onChange={(e) => setData({ ...data, department: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">담당자 이름</label>
        <input type="text" value={data.requesterName}
          onChange={(e) => setData({ ...data, requesterName: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
        <input type="email" value={data.requesterEmail}
          onChange={(e) => setData({ ...data, requesterEmail: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">현재 업무 방식 (As-Is)</label>
        <textarea value={data.asIs}
          onChange={(e) => setData({ ...data, asIs: e.target.value })}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">기대 효익</label>
        <textarea value={data.expectedBenefit}
          onChange={(e) => setData({ ...data, expectedBenefit: e.target.value })}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">데이터 기밀등급</label>
        <select value={data.confidentialityLevel}
          onChange={(e) => setData({ ...data, confidentialityLevel: e.target.value as 'G1' | 'G2' | 'G3' })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="G1">G1 — 공개·저민감</option>
          <option value="G2">G2 — 사내일반</option>
          <option value="G3">G3 — 고기밀</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">챔피언</label>
        <input type="text" value={data.championName}
          onChange={(e) => setData({ ...data, championName: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">예상 사용자 수</label>
        <input type="number" value={data.estimatedUsers}
          onChange={(e) => setData({ ...data, estimatedUsers: parseInt(e.target.value) || 0 })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <button type="submit" disabled={submitting}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold mt-2 hover:bg-blue-700 transition-colors disabled:opacity-40">
        {submitting ? '평가 중... (30초~1분 소요)' : '신청서 제출 및 AI 평가 시작'}
      </button>
    </form>
  )
}
