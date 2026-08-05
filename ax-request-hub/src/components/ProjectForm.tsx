'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TechStandardsState {
  techHasApiSpec: boolean
  techHasDataClassification: boolean
  techHasAuditLogging: boolean
  techHasTestCoverage: boolean
}

interface DataRequirement {
  assetDescription: string
  trackType: 'ACCESS' | 'NEW'
  classification: 'G1' | 'G2' | 'G3'
  periodMonths: number
  includesPII: boolean
  purpose: string
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

const inputCls = `w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500`

export function ProjectForm({ initialData }: { initialData: ProjectFormData }) {
  const [data, setData] = useState(initialData)
  const [tech, setTech] = useState<TechStandardsState>({
    techHasApiSpec: false,
    techHasDataClassification: false,
    techHasAuditLogging: false,
    techHasTestCoverage: false,
  })
  const [noDataRequired, setNoDataRequired] = useState(false)
  const [dataRequirements, setDataRequirements] = useState<DataRequirement[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function addDataRequirement() {
    setDataRequirements(prev => [...prev, {
      assetDescription: '',
      trackType: 'ACCESS',
      classification: 'G2',
      periodMonths: 12,
      includesPII: false,
      purpose: '',
    }])
  }

  function updateDataRequirement(idx: number, patch: Partial<DataRequirement>) {
    setDataRequirements(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function removeDataRequirement(idx: number) {
    setDataRequirements(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Q1 검증
    if (!noDataRequired && dataRequirements.length === 0) {
      setError('데이터 요건을 선언하거나 "별도 데이터 불필요"를 체크해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const patchRes = await fetch(`/api/projects/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, ...tech, noDataRequired, dataRequirements }),
      })
      if (!patchRes.ok) {
        const err = await patchRes.json()
        throw new Error(err.error ?? '제출 오류')
      }
      await fetch(`/api/evaluate/${data.id}`, { method: 'POST' })
      router.push(`/status/${data.id}`)
    } catch (e: any) {
      setError(e.message ?? '제출 중 오류가 발생했습니다.')
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
          className={inputCls} />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">신청 부서</label>
        <input type="text" value={data.department}
          onChange={(e) => setData({ ...data, department: e.target.value })}
          className={inputCls} />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">담당자 이름</label>
        <input type="text" value={data.requesterName}
          onChange={(e) => setData({ ...data, requesterName: e.target.value })}
          className={inputCls} />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
        <input type="email" value={data.requesterEmail}
          onChange={(e) => setData({ ...data, requesterEmail: e.target.value })}
          className={inputCls} />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">현재 업무 방식 (As-Is)</label>
        <textarea value={data.asIs}
          onChange={(e) => setData({ ...data, asIs: e.target.value })}
          rows={3} className={inputCls} />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">기대 효익</label>
        <textarea value={data.expectedBenefit}
          onChange={(e) => setData({ ...data, expectedBenefit: e.target.value })}
          rows={2} className={inputCls} />
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
          className={inputCls}>
          <option value="G1">G1 — 공개정보</option>
          <option value="G2">G2 — 대외비</option>
          <option value="G3">G3 — 기밀(극비)</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">챔피언</label>
        <input type="text" value={data.championName}
          onChange={(e) => setData({ ...data, championName: e.target.value })}
          className={inputCls} />
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">예상 사용자 수</label>
        <input type="number" value={data.estimatedUsers}
          onChange={(e) => setData({ ...data, estimatedUsers: parseInt(e.target.value) || 0 })}
          className={inputCls} />
      </div>

      {/* 본질적 업무 여부 */}
      <div className="mb-4 border border-orange-200 rounded-xl p-4 bg-orange-50">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={data.isEssentialBusiness ?? false}
            onChange={(e) => setData({ ...data, isEssentialBusiness: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
          <div>
            <span className="text-sm font-semibold text-orange-900">본질적 업무 해당</span>
            <p className="text-xs text-orange-700 mt-0.5">
              데이터취급지침 제5조 — G3(기밀·극비) 데이터 사용 시 필수 선결 조건.
              이 AI 활용이 회사의 핵심 운용·투자 의사결정 업무에 직결됨을 확인합니다.
            </p>
          </div>
        </label>
      </div>

      {/* ──────────────────────────────────────────
          Phase A: 데이터 요건 선언 (Q1 — 필수)
         ────────────────────────────────────────── */}
      <div className="mb-6 border border-indigo-200 rounded-xl p-4 bg-indigo-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">데이터 요건</span>
          <span className="text-sm font-semibold text-indigo-900">필요한 데이터를 지금 신청하세요</span>
          <span className="ml-auto text-xs text-red-500 font-medium">필수</span>
        </div>
        <p className="text-xs text-indigo-600 mb-3">
          과제 승인 후 DATA_PLATFORM 팀이 검토합니다. 에이전트 Gate 2 진입 전까지 승인이 완료되어야 합니다.
        </p>

        {/* 별도 데이터 불필요 토글 */}
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={noDataRequired}
            onChange={(e) => {
              setNoDataRequired(e.target.checked)
              if (e.target.checked) setDataRequirements([])
            }}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <span className="text-sm text-gray-700">이 과제는 별도 데이터가 필요 없습니다 (외부 공개 API, 내부 생성 데이터 등)</span>
        </label>

        {!noDataRequired && (
          <div className="space-y-3">
            {dataRequirements.map((req, idx) => (
              <div key={idx} className="bg-white border border-indigo-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-indigo-700">데이터 #{idx + 1}</span>
                  <button type="button" onClick={() => removeDataRequirement(idx)}
                    className="text-xs text-red-400 hover:text-red-600">삭제</button>
                </div>
                <div className="mb-2">
                  <label className="text-xs text-gray-500 mb-1 block">데이터 자산 설명</label>
                  <input type="text" value={req.assetDescription}
                    onChange={(e) => updateDataRequirement(idx, { assetDescription: e.target.value })}
                    placeholder="예: 6개월치 ETF 펀드플로우 데이터"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-400" />
                </div>
                <div className="mb-2">
                  <label className="text-xs text-gray-500 mb-1 block">사용 목적</label>
                  <input type="text" value={req.purpose}
                    onChange={(e) => updateDataRequirement(idx, { purpose: e.target.value })}
                    placeholder="예: 에이전트 학습 및 추론용"
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-400" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Track</label>
                    <select value={req.trackType}
                      onChange={(e) => updateDataRequirement(idx, { trackType: e.target.value as 'ACCESS' | 'NEW' })}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-400">
                      <option value="ACCESS">A — 기존 데이터 접근</option>
                      <option value="NEW">B — 신규 데이터 수집</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">기밀등급</label>
                    <select value={req.classification}
                      onChange={(e) => updateDataRequirement(idx, { classification: e.target.value as 'G1' | 'G2' | 'G3' })}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-400">
                      <option value="G1">G1 공개</option>
                      <option value="G2">G2 대외비</option>
                      <option value="G3">G3 기밀</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">기간(월)</label>
                    <input type="number" min={1} max={60} value={req.periodMonths}
                      onChange={(e) => updateDataRequirement(idx, { periodMonths: parseInt(e.target.value) || 12 })}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-400" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={req.includesPII}
                    onChange={(e) => updateDataRequirement(idx, { includesPII: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600" />
                  개인정보(PII) 포함
                </label>
              </div>
            ))}

            <button type="button" onClick={addDataRequirement}
              className="w-full border border-dashed border-indigo-300 text-indigo-600 rounded-lg py-2 text-sm hover:bg-indigo-50 transition-colors">
              + 데이터 요건 추가
            </button>
          </div>
        )}

        {!noDataRequired && dataRequirements.length === 0 && (
          <p className="text-xs text-red-500 mt-2">
            ※ 데이터 요건을 추가하거나 "별도 데이터 불필요"를 체크해야 제출할 수 있습니다.
          </p>
        )}
      </div>

      {/* Gate 2 기술 표준 체크리스트 */}
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
              <input type="checkbox" checked={tech[item.key]}
                onChange={(e) => setTech({ ...tech, [item.key]: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
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
