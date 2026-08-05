'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TechStandardsState {
  techHasApiSpec: boolean
  techHasDataClassification: boolean
  techHasAuditLogging: boolean
  techHasTestCoverage: boolean
}

interface ProjectFormData {
  id: string
  title: string
  department: string
  requesterName: string
  requesterEmail: string
  description: string
  asIs: string
  expectedBenefit: string
  expectedBenefitValue?: number | null
  expectedBenefitUnit?: string | null
  confidentialityLevel: 'G1' | 'G2' | 'G3'
  championName: string
  estimatedUsers: number
  isEssentialBusiness?: boolean
}

export function ProjectForm({ initialData }: { initialData: ProjectFormData }) {
  const [data, setData] = useState(initialData)
  const [tech, setTech] = useState<TechStandardsState>({
    techHasApiSpec: false,
    techHasDataClassification: false,
    techHasAuditLogging: false,
    techHasTestCoverage: false,
  })
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
        body: JSON.stringify({ ...data, ...tech }),
      })
      await fetch(`/api/evaluate/${data.id}`, { method: 'POST' })
      router.push(`/status/${data.id}`)
    } catch {
      setError('제출 중 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  const techItems: { key: keyof TechStandardsState; label: string; desc: string }[] = [
    { key: 'techHasApiSpec', label: 'API 스펙 문서', desc: 'OpenAPI 3.0 또는 동등한 입출력 인터페이스 문서가 존재한다' },
    { key: 'techHasDataClassification', label: '기밀등급 처리 방식', desc: '데이터 기밀등급(G1/G2/G3)별 처리 방식이 문서화되어 있다' },
    { key: 'techHasAuditLogging', label: '로깅·감사추적', desc: '에이전트 실행마다 감사 이벤트를 기록하는 로깅이 구현되어 있다' },
    { key: 'techHasTestCoverage', label: '테스트 커버리지', desc: '핵심 비즈니스 로직 80% 이상 단위 테스트가 작성되어 있다' },
  ]

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">AI 활용명</label>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          정량 예상 효과 <span className="text-gray-400 font-normal">(선택)</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">정식 운영 전환 후 실현 효과와 비교하는 데 사용됩니다. 대략적인 추정이면 충분합니다.</p>
        <div className="flex gap-2">
          <input type="number" min={0}
            value={data.expectedBenefitValue ?? ''}
            onChange={(e) => setData({ ...data, expectedBenefitValue: e.target.value ? Number(e.target.value) : null })}
            placeholder="예: 500"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <select
            value={data.expectedBenefitUnit ?? ''}
            onChange={(e) => setData({ ...data, expectedBenefitUnit: e.target.value || null })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">단위 선택</option>
            <option value="HOURS_YEAR">시간/년</option>
            <option value="KRW_10K_YEAR">만원/년</option>
          </select>
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">데이터 기밀등급</label>
        <select value={data.confidentialityLevel}
          onChange={(e) => setData({ ...data, confidentialityLevel: e.target.value as 'G1' | 'G2' | 'G3' })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="G1">G1 — 공개정보</option>
          <option value="G2">G2 — 대외비</option>
          <option value="G3">G3 — 기밀(극비)</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">챔피언</label>
        <input type="text" value={data.championName}
          onChange={(e) => setData({ ...data, championName: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">예상 사용자 수</label>
        <input type="number" value={data.estimatedUsers}
          onChange={(e) => setData({ ...data, estimatedUsers: parseInt(e.target.value) || 0 })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* 본질적 업무 여부 (데이터취급지침 제5조 — G3 데이터 사용 선결 조건) */}
      <div className="mb-4 border border-orange-200 rounded-xl p-4 bg-orange-50">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.isEssentialBusiness ?? false}
            onChange={(e) => setData({ ...data, isEssentialBusiness: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          <div>
            <span className="text-sm font-semibold text-orange-900">본질적 업무 해당</span>
            <p className="text-xs text-orange-700 mt-0.5">
              데이터취급지침 제5조 — G3(기밀·극비) 데이터 사용 시 필수 선결 조건.
              이 AI 활용이 회사의 핵심 운용·투자 의사결정 업무에 직결됨을 확인합니다.
            </p>
          </div>
        </label>
      </div>

      {/* Gate 2: 기술 표준 체크리스트 */}
      <div className="mb-6 border border-blue-200 rounded-xl p-4 bg-blue-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Gate 2</span>
          <span className="text-sm font-semibold text-blue-900">기술 표준 준수 체크리스트</span>
        </div>
        <p className="text-xs text-blue-600 mb-3">
          ai-agent-standards 기준 — 미충족 항목은 Gate 2 보류 사유가 됩니다
        </p>
        <div className="space-y-2">
          {techItems.map((item) => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={tech[item.key]}
                onChange={(e) => setTech({ ...tech, [item.key]: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">{item.label}</span>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </label>
          ))}
        </div>
        {Object.values(tech).some(v => !v) && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            미체크 항목은 Gate 2 보류 처리됩니다. 개발 진행 중이라면 해당 항목 완료 후 Gate 2 재심사 신청 가능합니다.
          </p>
        )}
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <button type="submit" disabled={submitting}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold mt-2 hover:bg-blue-700 transition-colors disabled:opacity-40">
        {submitting ? '평가 중... (30초~1분 소요)' : '신청서 제출 및 AI 평가 시작'}
      </button>
    </form>
  )
}
