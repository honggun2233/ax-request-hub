'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'

const CARD   = '#1E293B'
const BDR    = '#334155'
const ACCENT = '#3B82F6'
const TEXT   = '#F1F5F9'
const MUTED  = '#94A3B8'
const DIM    = '#64748B'

const 대분류_OPTIONS = ['운용관리', '고객서비스', '내부행정', '리스크관리', '데이터분석', '상품개발', '컴플라이언스', '기타']
const 중분류_OPTIONS = ['자동화', '분석/예측', '콘텐츠생성', '의사결정지원', '모니터링/알림', '보고서/문서화', '기타']
const 소분류_OPTIONS = ['일간업무 자동화', '정기보고 자동화', '실시간 모니터링', '이상탐지', '데이터 정합성 검증', '기타']
const DEPT_OPTIONS   = ['AX팀', '데이터플랫폼팀', 'IT업무개발팀', '정보보호팀', '운용본부', '리스크관리팀', '고객지원팀', '컴플라이언스팀', '기타']

interface DataRequirement {
  assetDescription: string
  trackType: 'ACCESS' | 'NEW'
  classification: 'G1' | 'G2' | 'G3'
  periodMonths: number
  includesPII: boolean
}

interface FormState {
  title: string; 대분류: string; 중분류: string; 소분류: string
  목적: string; asIs: string; expectedBenefit: string
  department: string; confidentialityLevel: string
}

const INIT: FormState = {
  title: '', 대분류: '', 중분류: '', 소분류: '',
  목적: '', asIs: '', expectedBenefit: '', department: '', confidentialityLevel: 'G2',
}

const EMPTY_REQ = (): DataRequirement => ({
  assetDescription: '', trackType: 'ACCESS', classification: 'G2', periodMonths: 12, includesPII: false,
})

const inputSt: React.CSSProperties = {
  width: '100%', background: '#0F172A', border: `1px solid ${BDR}`, borderRadius: 6,
  padding: '8px 12px', fontSize: 13, color: TEXT, outline: 'none', boxSizing: 'border-box',
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: '#F87171', marginLeft: 3 }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: 11, color: DIM, marginBottom: 5, lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  )
}

export default function NewProjectPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INIT)
  const [noDataRequired, setNoDataRequired] = useState(false)
  const [dataRequirements, setDataRequirements] = useState<DataRequirement[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') return <div style={{ padding: 40, color: MUTED, fontSize: 13 }}>로그인 확인 중…</div>
  if (status === 'unauthenticated') { router.push('/login'); return null }

  const user = session?.user as any
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const addReq = () => setDataRequirements(r => [...r, EMPTY_REQ()])
  const removeReq = (i: number) => setDataRequirements(r => r.filter((_, idx) => idx !== i))
  const setReq = (i: number, patch: Partial<DataRequirement>) =>
    setDataRequirements(r => r.map((req, idx) => idx === i ? { ...req, ...patch } : req))

  const dataOk = noDataRequired || dataRequirements.length > 0
  const valid = form.title.trim() && form.대분류 && form.목적.trim().length >= 20 &&
    form.asIs.trim().length >= 10 && form.expectedBenefit.trim().length >= 10 && form.department && dataOk

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSubmitting(true); setError(null)
    try {
      const classInfo = [form.대분류, form.중분류, form.소분류].filter(Boolean).join(' > ')
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, department: form.department,
          requesterName: user?.name ?? '', requesterEmail: user?.email ?? '',
          description: `[분류: ${classInfo}]\n\n${form.목적}`,
          asIs: form.asIs, expectedBenefit: form.expectedBenefit,
          confidentialityLevel: form.confidentialityLevel, source: 'direct',
          noDataRequired, dataRequirements: noDataRequired ? [] : dataRequirements,
        }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `HTTP ${res.status}`) }
      const project = await res.json()
      router.push(`/status/${project.id}`)
    } catch (e: any) { setError(e.message); setSubmitting(false) }
  }

  const card: React.CSSProperties = { background: CARD, border: `1px solid ${BDR}`, borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }

  return (
    <div style={{ color: TEXT, maxWidth: 680, margin: '0 auto', paddingBottom: 60 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>AI 활용 신청</h1>
        <p style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>AI를 활용하려는 업무를 등록하면 AX팀이 검토 후 승인합니다.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 01 기본 정보 */}
        <div style={card}>
          <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: '.08em', textTransform: 'uppercase', margin: 0 }}>01 / 기본 정보</p>
          <Field label="AI 활용명" required>
            <input type="text" value={form.title} onChange={set('title')}
              placeholder="예: ETF 운용 리포트 자동 생성" style={inputSt} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="대분류" required>
              <select value={form.대분류} onChange={set('대분류')} style={inputSt}>
                <option value="">선택</option>
                {대분류_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="중분류">
              <select value={form.중분류} onChange={set('중분류')} style={inputSt}>
                <option value="">선택(선택)</option>
                {중분류_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="소분류">
              <select value={form.소분류} onChange={set('소분류')} style={inputSt}>
                <option value="">선택(선택)</option>
                {소분류_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="신청 부서" required>
              <select value={form.department} onChange={set('department')} style={inputSt}>
                <option value="">선택</option>
                {DEPT_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="기밀등급" hint="G1=공개 G2=대외비 G3=극비">
              <select value={form.confidentialityLevel} onChange={set('confidentialityLevel')} style={inputSt}>
                <option value="G1">G1 — 공개정보</option>
                <option value="G2">G2 — 대외비 (기본)</option>
                <option value="G3">G3 — 기밀(극비)</option>
              </select>
            </Field>
          </div>
        </div>

        {/* 02 업무 기술 */}
        <div style={card}>
          <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: '.08em', textTransform: 'uppercase', margin: 0 }}>02 / 업무 기술</p>
          <Field label="목적" required hint="이 AI 활용을 왜 하려는지 설명하세요. (20자 이상)">
            <textarea value={form.목적} onChange={set('목적')} rows={3}
              placeholder="예: 운용역이 매일 수작업으로 작성하는 리포트를 자동화하여 시간을 절약하고 오류를 줄이고자 함"
              style={{ ...inputSt, resize: 'none' }} />
            <p style={{ fontSize: 11, color: DIM, textAlign: 'right', marginTop: 4 }}>{form.목적.length}자</p>
          </Field>
          <Field label="현황 (AS-IS)" required hint="현재 어떻게 하고 있는지 설명하세요.">
            <textarea value={form.asIs} onChange={set('asIs')} rows={3}
              placeholder="예: 현재 운용역이 매일 2시간씩 엑셀로 수동 작성 중. 주 3회 오류 발생."
              style={{ ...inputSt, resize: 'none' }} />
          </Field>
          <Field label="기대효과" required hint="AI 도입 후 어떤 변화가 예상되는지 구체적으로 적어주세요.">
            <textarea value={form.expectedBenefit} onChange={set('expectedBenefit')} rows={3}
              placeholder="예: 리포트 작성 시간 90% 단축(2시간 → 10분), 오류율 0% 예상"
              style={{ ...inputSt, resize: 'none' }} />
          </Field>
        </div>

        {/* 03 데이터 요건 */}
        <div style={{ ...card, borderLeft: `3px solid ${ACCENT}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: '.08em', textTransform: 'uppercase', margin: 0 }}>
              03 / 데이터 요건 <span style={{ color: '#F87171' }}>*</span>
            </p>
            <span style={{ fontSize: 10, color: DIM, background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', padding: '2px 8px', borderRadius: 10 }}>
              승인 시 DATA_PLATFORM팀 검토로 전달
            </span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={noDataRequired}
              onChange={e => { setNoDataRequired(e.target.checked); if (e.target.checked) setDataRequirements([]) }}
              style={{ width: 15, height: 15, accentColor: ACCENT }} />
            <div>
              <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>별도 데이터 불필요</span>
              <span style={{ fontSize: 11, color: DIM, marginLeft: 8 }}>공개 데이터·AI 모델 자체 지식만 사용</span>
            </div>
          </label>

          {!noDataRequired && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dataRequirements.map((req, idx) => (
                <div key={idx} style={{ background: '#0F172A', border: `1px solid ${BDR}`, borderRadius: 6, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '.04em' }}>데이터 {idx + 1}</span>
                    <button type="button" onClick={() => removeReq(idx)}
                      style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <Field label="자산·데이터 설명" required>
                    <input type="text" value={req.assetDescription}
                      onChange={e => setReq(idx, { assetDescription: e.target.value })}
                      placeholder="예: KRX 일별 ETF 가격, 고객 포트폴리오 DB" style={inputSt} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <Field label="트랙 유형">
                      <select value={req.trackType} onChange={e => setReq(idx, { trackType: e.target.value as 'ACCESS' | 'NEW' })} style={inputSt}>
                        <option value="ACCESS">ACCESS — 기존 데이터 접근</option>
                        <option value="NEW">NEW — 신규 수집</option>
                      </select>
                    </Field>
                    <Field label="기밀등급">
                      <select value={req.classification} onChange={e => setReq(idx, { classification: e.target.value as 'G1' | 'G2' | 'G3' })} style={inputSt}>
                        <option value="G1">G1 — 공개</option>
                        <option value="G2">G2 — 대외비</option>
                        <option value="G3">G3 — 기밀</option>
                      </select>
                    </Field>
                    <Field label="필요 기간(개월)">
                      <input type="number" min={1} max={120} value={req.periodMonths}
                        onChange={e => setReq(idx, { periodMonths: Number(e.target.value) })} style={inputSt} />
                    </Field>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={req.includesPII}
                      onChange={e => setReq(idx, { includesPII: e.target.checked })}
                      style={{ width: 14, height: 14, accentColor: '#F59E0B' }} />
                    <span style={{ fontSize: 12, color: req.includesPII ? '#FCD34D' : MUTED }}>개인식별정보(PII) 포함</span>
                    {req.includesPII && (
                      <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', padding: '1px 6px', borderRadius: 8 }}>
                        개인정보보호 검토 필요
                      </span>
                    )}
                  </label>
                </div>
              ))}

              <button type="button" onClick={addReq} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'none', border: `1px dashed ${BDR}`, borderRadius: 6,
                padding: '10px', fontSize: 13, color: MUTED, cursor: 'pointer', width: '100%',
              }}>
                <Plus size={14} /> 데이터 요건 추가
              </button>

              {dataRequirements.length === 0 && (
                <p style={{ fontSize: 11, color: '#F87171', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, padding: '8px 12px' }}>
                  데이터 요건을 추가하거나 위에서 "별도 데이터 불필요"를 선택해주세요.
                </p>
              )}
            </div>
          )}
        </div>

        {/* 신청자 */}
        <div style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${BDR}`, borderRadius: 6, padding: '10px 16px', fontSize: 12, color: DIM }}>
          <span style={{ fontWeight: 600, color: MUTED }}>신청자:</span> {user?.name} ({user?.email})
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#F87171' }}>
            오류: {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={!valid || submitting} style={{
            flex: 1, background: (valid && !submitting) ? ACCENT : '#1A2535',
            border: `1px solid ${(valid && !submitting) ? ACCENT : BDR}`,
            color: (valid && !submitting) ? '#fff' : DIM,
            borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 600,
            cursor: (valid && !submitting) ? 'pointer' : 'not-allowed',
          }}>
            {submitting ? '제출 중…' : 'AI 활용 신청'}
          </button>
          <button type="button" onClick={() => router.back()} style={{
            background: 'none', border: `1px solid ${BDR}`, color: MUTED,
            borderRadius: 6, padding: '10px 20px', fontSize: 13, cursor: 'pointer',
          }}>
            취소
          </button>
        </div>
      </form>
    </div>
  )
}
