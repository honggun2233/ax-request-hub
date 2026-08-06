'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Appeal = {
  id: string
  reason: string
  evidenceNote: string
  status: string
  reviewNote: string
  reviewedBy: string | null
  createdAt: string
  resolvedAt: string | null
}

const AP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:      { label: '심사 대기', color: '#FFB74D', bg: 'rgba(208,123,58,.12)' },
  UNDER_REVIEW: { label: '심사 중',   color: '#FFB74D', bg: 'rgba(208,123,58,.12)' },
  ACCEPTED:     { label: '수용됨',    color: '#7EB88A', bg: 'rgba(91,140,110,.15)' },
  REJECTED:     { label: '기각됨',    color: '#E57373', bg: 'rgba(229,115,115,.12)' },
}

export function AppealSection({
  projectId, appeals, canAppeal,
}: { projectId: string; appeals: Appeal[]; canAppeal: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latest = appeals[0] ?? null
  const hasActive = !!latest && ['PENDING', 'UNDER_REVIEW'].includes(latest.status)

  const submit = async () => {
    if (!reason.trim()) { setError('이의제기 사유를 입력하세요.'); return }
    setSaving(true); setError(null)
    const res = await fetch(`/api/projects/${projectId}/appeal`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, evidenceNote }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? '제출에 실패했습니다.')
      return
    }
    setOpen(false); setReason(''); setEvidenceNote(''); router.refresh()
  }

  // 제기도 불가하고 이력도 없으면 섹션 자체를 숨김
  if (!canAppeal && appeals.length === 0) return null

  const inputSt: React.CSSProperties = {
    width: '100%', background: '#152440', border: '1px solid #2E456A', borderRadius: 2,
    padding: '8px 10px', fontSize: 13, color: '#D4DDE8', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ background: '#1C3055', border: '1px solid #2E456A', borderRadius: 2, marginTop: 16, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#7A94B0', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 3, height: 14, background: '#C9A96E', borderRadius: 1, display: 'inline-block' }} />
          이의제기
        </div>
        {canAppeal && !hasActive && (
          <button onClick={() => setOpen(true)}
            style={{ fontSize: 12, fontWeight: 600, color: '#0F1C2B', background: '#C9A96E', border: 'none', borderRadius: 2, padding: '6px 14px', cursor: 'pointer' }}>
            이의 제기하기
          </button>
        )}
      </div>

      {canAppeal && appeals.length === 0 && (
        <p style={{ fontSize: 12, color: '#7A94B0', marginTop: 10, lineHeight: 1.5 }}>
          심사 결과에 이견이 있으면 사유를 작성해 이의를 제기할 수 있습니다. AX팀이 검토 후 결과를 알려드립니다.
        </p>
      )}

      {/* 이의제기 이력 */}
      {appeals.map(a => {
        const st = AP_STATUS[a.status] ?? AP_STATUS['PENDING']
        return (
          <div key={a.id} style={{ borderTop: '1px solid #2E456A', paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 2, color: st.color, background: st.bg, border: `1px solid ${st.color}55` }}>
                {st.label}
              </span>
              <span style={{ fontSize: 11, color: '#7A94B0' }}>{new Date(a.createdAt).toLocaleDateString('ko-KR')}</span>
            </div>
            <div style={{ fontSize: 13, color: '#D4DDE8', lineHeight: 1.5 }}>{a.reason}</div>
            {a.evidenceNote && <div style={{ fontSize: 12, color: '#7A94B0', marginTop: 4, lineHeight: 1.5 }}>{a.evidenceNote}</div>}
            {a.reviewNote && (
              <div style={{ marginTop: 8, borderLeft: '3px solid #2E456A', paddingLeft: 10, fontSize: 12, color: '#9FB3C8', lineHeight: 1.5 }}>
                <span style={{ color: '#7A94B0' }}>AX팀 검토:</span> {a.reviewNote}
              </div>
            )}
          </div>
        )
      })}

      {/* 이의제기 모달 */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }} onClick={() => !saving && setOpen(false)} />
          <div style={{ position: 'relative', background: '#1C3055', border: '1px solid #2E456A', borderRadius: 4, width: '100%', maxWidth: 440, margin: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #2E456A', background: '#080F1C' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#EBF0F5' }}>이의 제기</span>
              <button onClick={() => !saving && setOpen(false)} style={{ background: 'none', border: 'none', color: '#7A94B0', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A94B0', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  이의제기 사유 <span style={{ color: '#E57373' }}>*</span>
                </label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  placeholder="심사 결과에 대한 이견을 구체적으로 작성하세요"
                  style={{ ...inputSt, resize: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#7A94B0', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  근거 자료·보충 설명 <span style={{ fontWeight: 400, textTransform: 'none' }}>(선택)</span>
                </label>
                <textarea value={evidenceNote} onChange={e => setEvidenceNote(e.target.value)} rows={2}
                  placeholder="추가 근거가 있으면 작성하세요"
                  style={{ ...inputSt, resize: 'none' }} />
              </div>
              {error && (
                <div style={{ background: 'rgba(229,115,115,.1)', border: '1px solid rgba(229,115,115,.3)', borderRadius: 2, padding: '8px 10px', fontSize: 12, color: '#E57373' }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setOpen(false)} disabled={saving}
                  style={{ flex: 1, padding: '9px', background: 'none', border: '1px solid #2E456A', color: '#7A94B0', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                  취소
                </button>
                <button onClick={submit} disabled={saving}
                  style={{ flex: 1, padding: '9px', background: saving ? '#2E456A' : '#C9A96E', border: 'none', color: '#0F1C2B', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? '제출 중...' : '제출'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
