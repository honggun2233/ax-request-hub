'use client'
import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const SURFACE = '#FFFFFF'
const LINE    = '#E4E9F2'
const BLUE    = '#4A6FA5'
const GOLD    = '#B8956A'
const TEXT    = '#18243D'
const MUTED   = '#8898BB'
const DIM     = '#BEC8DC'
const BG      = '#F7F9FC'

const GREEN  = '#22c55e'
const YELLOW = '#f59e0b'
const RED    = '#ef4444'

type Stage = 'idle' | 'analyzing' | 'review' | 'submitting'

interface FieldValue {
  value: string | null
  confidence: number
  source: string
  edited?: boolean
}

interface SynthesisResult {
  fields: {
    title: FieldValue
    description: FieldValue
    asIs: FieldValue
    expectedBenefit: FieldValue
    agentType: FieldValue
    scope: FieldValue
    confidentialityEstimate: FieldValue
    dataNote: FieldValue
  }
  prefilled: {
    department: string
    requesterName: string
    requesterEmail: string
  }
  materialCount: number
}

const card: React.CSSProperties = {
  background: SURFACE,
  border: `1px solid ${LINE}`,
  borderRadius: 8,
  padding: '20px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const labelSt: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: MUTED,
  marginBottom: 5,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  display: 'block',
}

const inputSt: React.CSSProperties = {
  width: '100%',
  background: SURFACE,
  border: `1px solid ${LINE}`,
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 13,
  color: TEXT,
  outline: 'none',
  boxSizing: 'border-box',
  resize: 'none',
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 85 ? GREEN : confidence >= 60 ? YELLOW : RED
  const label = confidence >= 85 ? '고신뢰' : confidence >= 60 ? '중신뢰' : '저신뢰'
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      color,
      background: `${color}22`,
      border: `1px solid ${color}55`,
      borderRadius: 10,
      padding: '2px 8px',
      marginLeft: 6,
      letterSpacing: '.02em',
    }}>
      {confidence}% {label}
    </span>
  )
}

function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[]
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active ? null : o.value)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: `1px solid ${active ? BLUE : LINE}`,
              background: active ? BLUE : SURFACE,
              color: active ? '#fff' : MUTED,
              fontSize: 12,
              fontWeight: active ? 700 : 400,
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function EditableField({
  label,
  fieldValue,
  multiline,
  onSave,
}: {
  label: string
  fieldValue: FieldValue
  multiline?: boolean
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(fieldValue.value ?? '')
  const isEmpty = !fieldValue.value

  function startEdit() {
    setDraft(fieldValue.value ?? '')
    setEditing(true)
  }

  function save() {
    onSave(draft)
    setEditing(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <ConfidenceBadge confidence={fieldValue.confidence} />
        {fieldValue.edited && (
          <span style={{ fontSize: 10, color: GOLD, marginLeft: 6, background: `${GOLD}22`, border: `1px solid ${GOLD}55`, borderRadius: 8, padding: '1px 6px' }}>
            직접 수정됨
          </span>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {multiline ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={3}
              style={inputSt}
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              style={inputSt}
              autoFocus
            />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={save}
              style={{ fontSize: 12, padding: '4px 14px', borderRadius: 6, border: `1px solid ${BLUE}`, background: BLUE, color: '#fff', cursor: 'pointer' }}
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{ fontSize: 12, padding: '4px 14px', borderRadius: 6, border: `1px solid ${LINE}`, background: SURFACE, color: MUTED, cursor: 'pointer' }}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            flex: 1,
            fontSize: 13,
            color: isEmpty ? RED : TEXT,
            background: isEmpty ? 'rgba(239,68,68,.05)' : BG,
            border: `1px solid ${isEmpty ? 'rgba(239,68,68,.3)' : LINE}`,
            borderRadius: 6,
            padding: '8px 12px',
            minHeight: 36,
            whiteSpace: 'pre-wrap',
          }}>
            {isEmpty ? '(추출 실패 — 직접 입력 필요)' : fieldValue.value}
          </div>
          <button
            type="button"
            onClick={startEdit}
            style={{ fontSize: 11, padding: '6px 12px', borderRadius: 6, border: `1px solid ${LINE}`, background: SURFACE, color: MUTED, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            수정
          </button>
        </div>
      )}
    </div>
  )
}

export default function NewProjectPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [stage, setStage] = useState<Stage>('idle')
  const [files, setFiles] = useState<File[]>([])
  const [rawText, setRawText] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null)

  // Review state
  const [fields, setFields] = useState<SynthesisResult['fields'] | null>(null)
  const [agentType, setAgentType] = useState<string | null>(null)
  const [scope, setScope] = useState<string | null>(null)
  const [confidentialityLevel, setConfidentialityLevel] = useState<string | null>(null)
  const [dataRequired, setDataRequired] = useState<boolean | null>(null)
  const [dataNote, setDataNote] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (status === 'loading') return <div style={{ padding: 40, color: MUTED, fontSize: 13 }}>로그인 확인 중…</div>
  if (status === 'unauthenticated') { router.push('/login'); return null }

  function updateField(key: keyof SynthesisResult['fields'], value: string) {
    setFields(prev => {
      if (!prev) return prev
      return {
        ...prev,
        [key]: { ...prev[key], value, edited: true },
      }
    })
  }

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return
    const valid = Array.from(incoming).filter(f =>
      f.type.startsWith('text/') || f.name.endsWith('.md') || f.name.endsWith('.txt')
    )
    setFiles(prev => [...prev, ...valid])
  }

  async function handleAnalyze() {
    if (!files.length && !rawText.trim()) return
    setStage('analyzing')
    setAnalyzeError(null)

    try {
      const fd = new FormData()
      fd.append('rawText', rawText)
      for (const f of files) fd.append('files[]', f)

      const res = await fetch('/api/intake/synthesize', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)

      setSynthesis(data)
      setFields(data.fields)
      setAgentType(data.fields.agentType.value)
      setScope(data.fields.scope.value)
      setDataNote(data.fields.dataNote.value ?? '')
      setStage('review')
    } catch (e: any) {
      setAnalyzeError(e.message)
      setStage('idle')
    }
  }

  async function handleSubmit() {
    if (!fields || !synthesis) return
    if (!confidentialityLevel || dataRequired === null) return

    setStage('submitting')
    setSubmitError(null)

    const { prefilled } = synthesis

    const noDataRequired = !dataRequired
    const dataRequirements = dataRequired && dataNote.trim()
      ? [{ assetDescription: dataNote.trim(), trackType: 'ACCESS', classification: confidentialityLevel, periodMonths: 12, includesPII: false }]
      : []

    // If dataRequired but no description, still need to pass empty to avoid 400
    const payload = {
      title: fields.title.value ?? '',
      department: prefilled.department,
      requesterName: prefilled.requesterName,
      requesterEmail: prefilled.requesterEmail,
      description: fields.description.value ?? '',
      asIs: fields.asIs.value ?? '',
      expectedBenefit: fields.expectedBenefit.value ?? '',
      confidentialityLevel,
      agentType: agentType ?? undefined,
      scope: scope ?? undefined,
      intakeMethod: 'CHAT',
      aiConfidence: computeAvgConfidence(fields),
      noDataRequired,
      dataRequirements,
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      router.push(`/status/${data.id}`)
    } catch (e: any) {
      setSubmitError(e.message)
      setStage('review')
    }
  }

  function computeAvgConfidence(f: SynthesisResult['fields']) {
    const scores = [f.title, f.description, f.asIs, f.expectedBenefit].map(x => x.confidence)
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }

  const canSubmit =
    confidentialityLevel !== null &&
    dataRequired !== null &&
    fields?.title.value?.trim() &&
    fields?.description.value?.trim()

  // ─── IDLE ────────────────────────────────────────────────────────────────────
  if (stage === 'idle' || stage === 'analyzing') {
    return (
      <div style={{ color: TEXT, background: BG, maxWidth: 680, margin: '0 auto', paddingBottom: 60 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: TEXT, margin: 0 }}>에이전트 등록 신청</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>가진 자료를 다 던져주세요. AI가 정리합니다.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 파일 드롭존 */}
          <div style={card}>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? BLUE : LINE}`,
                borderRadius: 8,
                padding: '32px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? `${BLUE}08` : BG,
                transition: 'all .15s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>파일을 끌어다 놓거나 클릭해서 선택</p>
              <p style={{ fontSize: 11, color: DIM, marginTop: 4 }}>(.md, .txt 등 텍스트 파일)</p>
              {files.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {files.map((f, i) => (
                    <span key={i} style={{
                      fontSize: 11,
                      background: `${BLUE}15`,
                      border: `1px solid ${BLUE}40`,
                      color: BLUE,
                      borderRadius: 10,
                      padding: '2px 10px',
                    }}>
                      {f.name}
                      <span
                        style={{ marginLeft: 6, cursor: 'pointer', color: RED }}
                        onClick={ev => { ev.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)) }}
                      >×</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" multiple accept=".md,.txt,text/*" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          </div>

          {/* 자유 텍스트 */}
          <div style={card}>
            <label style={labelSt}>또는 자유롭게 설명해 주세요</label>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              rows={5}
              placeholder="슬랙 대화, 회의메모, 어떤 형식이든 괜찮아요."
              style={inputSt}
            />
          </div>

          {analyzeError && (
            <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: RED }}>
              오류: {analyzeError}
            </div>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={stage === 'analyzing' || (!files.length && !rawText.trim())}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              background: stage === 'analyzing' || (!files.length && !rawText.trim()) ? LINE : BLUE,
              color: stage === 'analyzing' || (!files.length && !rawText.trim()) ? DIM : '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: stage === 'analyzing' || (!files.length && !rawText.trim()) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            {stage === 'analyzing' ? (
              <>
                <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                AI가 자료를 분석하고 있습니다…
              </>
            ) : 'AI로 분석하기'}
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ─── REVIEW ──────────────────────────────────────────────────────────────────
  if ((stage === 'review' || stage === 'submitting') && fields && synthesis) {
    const { prefilled } = synthesis

    return (
      <div style={{ color: TEXT, background: BG, maxWidth: 680, margin: '0 auto', paddingBottom: 60 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: TEXT, margin: 0 }}>AI 분석 결과 확인</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>
            {synthesis.materialCount}개 자료를 분석했습니다. 내용을 확인하고 필요 항목을 선택해주세요.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 신청자 정보 (자동 채움) */}
          <div style={{
            background: '#F0F4FA',
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '12px 20px',
            fontSize: 13,
            color: MUTED,
          }}>
            <span style={{ fontWeight: 700, color: TEXT }}>신청자</span>
            &nbsp;{prefilled.requesterName}
            {prefilled.department && <> · <span style={{ color: BLUE }}>{prefilled.department}</span></>}
            <span style={{ marginLeft: 8, fontSize: 11 }}>({prefilled.requesterEmail})</span>
          </div>

          {/* AI 추출 필드 */}
          <div style={card}>
            <p style={{ fontSize: 11, fontWeight: 700, color: BLUE, letterSpacing: '.08em', textTransform: 'uppercase', margin: 0 }}>AI 추출 정보</p>

            <EditableField
              label="에이전트명"
              fieldValue={fields.title}
              onSave={v => updateField('title', v)}
            />
            <EditableField
              label="목적"
              fieldValue={fields.description}
              multiline
              onSave={v => updateField('description', v)}
            />
            <EditableField
              label="현재 상황 / As-Is"
              fieldValue={fields.asIs}
              multiline
              onSave={v => updateField('asIs', v)}
            />
            <EditableField
              label="기대 효과"
              fieldValue={fields.expectedBenefit}
              multiline
              onSave={v => updateField('expectedBenefit', v)}
            />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={labelSt}>에이전트 유형</span>
                <ConfidenceBadge confidence={fields.agentType.confidence} />
              </div>
              <ToggleGroup
                options={[
                  { label: 'SKILL', value: 'SKILL' },
                  { label: 'MCP', value: 'MCP' },
                  { label: 'WEBAPP', value: 'WEBAPP' },
                  { label: 'CRAWLING', value: 'CRAWLING' },
                ]}
                value={agentType}
                onChange={setAgentType}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <span style={labelSt}>공개 범위</span>
                <ConfidenceBadge confidence={fields.scope.confidence} />
              </div>
              <ToggleGroup
                options={[
                  { label: 'DEPT (부서)', value: 'DEPT' },
                  { label: 'DIVISION (본부)', value: 'DIVISION' },
                  { label: 'COMPANY (전사)', value: 'COMPANY' },
                ]}
                value={scope}
                onChange={setScope}
              />
            </div>
          </div>

          {/* 명시적 확인 필요 */}
          <div style={{ ...card, borderLeft: `3px solid ${GOLD}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: '.08em', textTransform: 'uppercase', margin: 0 }}>
              직접 확인 필요
            </p>

            {/* 기밀등급 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <label style={labelSt}>기밀등급 <span style={{ color: RED }}>*</span></label>
                {fields.confidentialityEstimate.value && (
                  <span style={{ fontSize: 11, color: MUTED, marginLeft: 6 }}>
                    AI 추정: {fields.confidentialityEstimate.value}
                    ({fields.confidentialityEstimate.confidence}%)
                  </span>
                )}
              </div>
              <p style={{ fontSize: 11, color: DIM, marginBottom: 8 }}>G1=공개 · G2=대외비 · G3=기밀(극비)</p>
              <ToggleGroup
                options={[
                  { label: 'G1 — 공개', value: 'PUBLIC' },
                  { label: 'G2 — 대외비', value: 'RESTRICTED' },
                  { label: 'G3 — 기밀', value: 'CONFIDENTIAL' },
                ]}
                value={confidentialityLevel}
                onChange={v => setConfidentialityLevel(v)}
              />
              {!confidentialityLevel && (
                <p style={{ fontSize: 11, color: RED, marginTop: 6 }}>기밀등급을 선택해야 합니다.</p>
              )}
            </div>

            {/* 데이터 요건 */}
            <div>
              <label style={labelSt}>데이터 요건 <span style={{ color: RED }}>*</span></label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                {[
                  { label: '필요합니다', value: true },
                  { label: '별도 데이터 없음', value: false },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setDataRequired(opt.value)}
                    style={{
                      padding: '7px 18px',
                      borderRadius: 20,
                      border: `1px solid ${dataRequired === opt.value ? BLUE : LINE}`,
                      background: dataRequired === opt.value ? BLUE : SURFACE,
                      color: dataRequired === opt.value ? '#fff' : MUTED,
                      fontSize: 12,
                      fontWeight: dataRequired === opt.value ? 700 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {dataRequired === true && (
                <div>
                  <label style={{ ...labelSt, marginBottom: 4 }}>데이터 설명</label>
                  <textarea
                    value={dataNote}
                    onChange={e => setDataNote(e.target.value)}
                    rows={2}
                    placeholder="예: KRX 일별 ETF 가격, 고객 포트폴리오 DB"
                    style={inputSt}
                  />
                </div>
              )}

              {dataRequired === null && (
                <p style={{ fontSize: 11, color: RED }}>데이터 요건을 선택해야 합니다.</p>
              )}
            </div>
          </div>

          {submitError && (
            <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: RED }}>
              오류: {submitError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || stage === 'submitting'}
              style={{
                flex: 1,
                padding: '12px 24px',
                borderRadius: 8,
                border: 'none',
                background: canSubmit && stage !== 'submitting' ? BLUE : LINE,
                color: canSubmit && stage !== 'submitting' ? '#fff' : DIM,
                fontSize: 14,
                fontWeight: 700,
                cursor: canSubmit && stage !== 'submitting' ? 'pointer' : 'not-allowed',
              }}
            >
              {stage === 'submitting' ? '제출 중…' : '신청 제출'}
            </button>
            <button
              type="button"
              onClick={() => { setStage('idle'); setSynthesis(null); setFields(null); setConfidentialityLevel(null); setDataRequired(null) }}
              style={{
                padding: '12px 20px',
                borderRadius: 8,
                border: `1px solid ${LINE}`,
                background: SURFACE,
                color: MUTED,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              다시 분석
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
