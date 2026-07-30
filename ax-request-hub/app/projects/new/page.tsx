'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const 대분류_OPTIONS = ['운용관리', '고객서비스', '내부행정', '리스크관리', '데이터분석', '상품개발', '컴플라이언스', '기타']
const 중분류_OPTIONS = ['자동화', '분석/예측', '콘텐츠생성', '의사결정지원', '모니터링/알림', '보고서/문서화', '기타']
const 소분류_OPTIONS = ['일간업무 자동화', '정기보고 자동화', '실시간 모니터링', '이상탐지', '데이터 정합성 검증', '기타']

const DEPT_OPTIONS = [
  'AX팀', '데이터플랫폼팀', 'IT업무개발팀', '정보보호팀',
  '운용본부', '리스크관리팀', '고객지원팀', '컴플라이언스팀', '기타',
]

interface FormState {
  title: string
  대분류: string
  중분류: string
  소분류: string
  목적: string
  asIs: string
  expectedBenefit: string
  department: string
  confidentialityLevel: string
}

const INIT: FormState = {
  title: '',
  대분류: '',
  중분류: '',
  소분류: '',
  목적: '',
  asIs: '',
  expectedBenefit: '',
  department: '',
  confidentialityLevel: 'G2',
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  )
}

export default function DirectProjectPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INIT)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') return <p className="p-6 text-sm text-gray-400">로그인 확인 중…</p>
  if (status === 'unauthenticated') { router.push('/login'); return null }

  const user = session?.user as any

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const valid =
    form.title.trim() &&
    form.대분류 &&
    form.목적.trim().length >= 20 &&
    form.asIs.trim().length >= 10 &&
    form.expectedBenefit.trim().length >= 10 &&
    form.department

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      const classInfo = [form.대분류, form.중분류, form.소분류].filter(Boolean).join(' > ')
      const description = `[분류: ${classInfo}]\n\n${form.목적}`
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          department: form.department,
          requesterName: user?.name ?? '',
          requesterEmail: user?.email ?? '',
          description,
          asIs: form.asIs,
          expectedBenefit: form.expectedBenefit,
          confidentialityLevel: form.confidentialityLevel,
          source: 'direct',
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      const project = await res.json()
      router.push(`/status/${project.id}`)
    } catch (e: any) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AI 과제 직접 신청</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI 상담 없이 과제 내용을 직접 작성합니다.{' '}
          <a href="/chat" className="text-blue-600 hover:underline">AI 상담으로 작성하기 →</a>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 과제명 */}
        <Field label="과제명" required>
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            placeholder="예: ETF 운용 리포트 자동 생성"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>

        {/* 분류 */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="대분류" required>
            <select
              value={form.대분류}
              onChange={set('대분류')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택</option>
              {대분류_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="중분류">
            <select
              value={form.중분류}
              onChange={set('중분류')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택(선택)</option>
              {중분류_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="소분류">
            <select
              value={form.소분류}
              onChange={set('소분류')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택(선택)</option>
              {소분류_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>

        {/* 목적 */}
        <Field label="목적" required hint="이 과제를 왜 하려는지, 해결하려는 문제는 무엇인지 설명하세요. (20자 이상)">
          <textarea
            value={form.목적}
            onChange={set('목적')}
            rows={3}
            placeholder="예: 운용역이 매일 수작업으로 작성하는 리포트를 자동화하여 시간을 절약하고 오류를 줄이고자 함"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-right text-xs text-gray-400">{form.목적.length}자</p>
        </Field>

        {/* 현황(AS-IS) */}
        <Field label="현황 (AS-IS)" required hint="현재 어떻게 하고 있는지, 어떤 문제가 있는지 설명하세요.">
          <textarea
            value={form.asIs}
            onChange={set('asIs')}
            rows={3}
            placeholder="예: 현재 운용역이 매일 2시간씩 엑셀로 수동 작성 중. 주 3회 오류 발생, 수정 1시간 소요."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </Field>

        {/* 기대효과 */}
        <Field label="기대효과" required hint="AI 도입 후 어떤 변화가 예상되는지 구체적으로 적어주세요.">
          <textarea
            value={form.expectedBenefit}
            onChange={set('expectedBenefit')}
            rows={3}
            placeholder="예: 리포트 작성 시간 90% 단축(2시간 → 10분), 오류율 0%로 감소 예상"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </Field>

        {/* 부서 + 기밀등급 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="신청 부서" required>
            <select
              value={form.department}
              onChange={set('department')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택</option>
              {DEPT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="기밀등급" hint="G1=공개 G2=내부 G3=기밀">
            <select
              value={form.confidentialityLevel}
              onChange={set('confidentialityLevel')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="G1">G1 — 공개</option>
              <option value="G2">G2 — 내부 (기본)</option>
              <option value="G3">G3 — 기밀</option>
            </select>
          </Field>
        </div>

        {/* 신청자 정보 (읽기 전용) */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
          <span className="font-medium">신청자:</span> {user?.name} ({user?.email})
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            오류: {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!valid || submitting}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {submitting ? '제출 중…' : '과제 신청'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  )
}
