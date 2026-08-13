'use client'
import { useState, useEffect } from 'react'

const BDR = '#E4E9F2'
const TEXT = '#18243D'
const MUTED = '#8898BB'
const DIM = '#BEC8DC'
const SB = '#F7F9FC'

const SEVERITY_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: 'rgba(239,68,68,.10)',  text: '#B91C1C', border: 'rgba(239,68,68,.35)',  label: '심각' },
  high:     { bg: 'rgba(249,115,22,.10)', text: '#C2410C', border: 'rgba(249,115,22,.35)', label: '높음' },
  medium:   { bg: 'rgba(245,158,11,.10)', text: '#B45309', border: 'rgba(245,158,11,.35)', label: '중간' },
  low:      { bg: 'rgba(59,130,246,.10)', text: '#1D4ED8', border: 'rgba(59,130,246,.35)', label: '낮음' },
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.low
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  )
}

interface ImpactResult {
  severity: string
  affected: {
    projects: Array<{ id: string; name: string; connectionType: string }>
    employees: Array<{ id: string; name: string; role: string }>
    agents: Array<{ id: string; name: string; connectionType: string }>
  }
  summary: string
}

interface Props {
  agentId: string
  agentName: string
  onClose: () => void
  onConfirm: () => void
}

export default function RetireConfirmModal({ agentId, agentName, onClose, onConfirm }: Props) {
  const [impact, setImpact] = useState<ImpactResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/graph/impact?type=agent&id=${agentId}`)
      .then(r => r.json())
      .then(data => { setImpact(data); setLoading(false) })
      .catch(() => { setError('영향도 조회 실패'); setLoading(false) })
  }, [agentId])

  const handleConfirm = async () => {
    if (reason.trim().length < 10) return
    setSaving(true)
    try {
      const res = await fetch('/api/registry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId, lifecycleStage: 'RETIRED', retireReason: reason.trim() }),
      })
      if (res.ok) { onConfirm() }
      else { setError('폐기 처리 실패'); setSaving(false) }
    } catch {
      setError('폐기 처리 실패'); setSaving(false)
    }
  }

  const canConfirm = reason.trim().length >= 10 && !saving

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,25,50,.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: 480, maxHeight: '85vh', background: '#FFFFFF',
        borderRadius: 12, border: `1px solid ${BDR}`, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.18)',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BDR}`, background: 'rgba(239,68,68,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#B91C1C', margin: 0 }}>폐기 전 영향도 확인</h3>
                <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{agentName}</p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: DIM, fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED, fontSize: 13 }}>
              영향도 분석 중...
            </div>
          )}

          {error && (
            <div style={{ padding: '12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 6, fontSize: 12, color: '#B91C1C' }}>
              {error}
            </div>
          )}

          {impact && !loading && (
            <>
              {/* 심각도 요약 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: SB, borderRadius: 8, border: `1px solid ${BDR}` }}>
                <SeverityBadge severity={impact.severity} />
                <p style={{ fontSize: 12, color: TEXT, margin: 0 }}>{impact.summary}</p>
              </div>

              {/* 영향받는 과제 */}
              {impact.affected.projects.length > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    영향받는 AI 활용 ({impact.affected.projects.length}건)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {impact.affected.projects.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: SB, borderRadius: 6, border: `1px solid ${BDR}`, fontSize: 12 }}>
                        <span style={{ color: TEXT, fontWeight: 500 }}>{p.name}</span>
                        <span style={{ color: DIM, fontSize: 10 }}>{p.connectionType}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 통보 대상 */}
              {impact.affected.employees.length > 0 && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    통보 대상 ({impact.affected.employees.length}명)
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {impact.affected.employees.map(e => (
                      <span key={e.id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: SB, border: `1px solid ${BDR}`, color: MUTED }}>
                        {e.name} <span style={{ color: DIM }}>({e.role})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {impact.affected.projects.length === 0 && impact.affected.employees.length === 0 && (
                <div style={{ padding: '12px 14px', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 6, fontSize: 12, color: '#065F46' }}>
                  ✓ 연결된 과제나 통보 대상이 없습니다. 안전하게 폐기할 수 있습니다.
                </div>
              )}
            </>
          )}

          {/* 폐기 사유 입력 */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: MUTED, display: 'block', marginBottom: 6 }}>
              폐기 사유 <span style={{ color: '#EF4444' }}>*</span>
              <span style={{ fontWeight: 400, marginLeft: 6 }}>(10자 이상 필수)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="폐기 사유를 구체적으로 입력하세요 (예: 정확도 지속 하락, 대체 에이전트 도입 등)"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', background: '#FFFFFF',
                border: `1px solid ${reason.length > 0 && reason.trim().length < 10 ? '#EF4444' : BDR}`,
                borderRadius: 6, padding: '8px 10px', fontSize: 12, color: TEXT,
                outline: 'none', resize: 'none', lineHeight: 1.5,
              }}
            />
            <p style={{ fontSize: 10, color: reason.trim().length >= 10 ? '#059669' : DIM, marginTop: 4, textAlign: 'right' }}>
              {reason.trim().length} / 10자 이상
            </p>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${BDR}`, background: SB, display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', background: '#FFFFFF', color: MUTED,
            border: `1px solid ${BDR}`, borderRadius: 6, fontSize: 13, cursor: 'pointer',
          }}>
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
            style={{
              flex: 1, padding: '10px', background: canConfirm ? '#EF4444' : 'rgba(239,68,68,.3)',
              color: '#FFFFFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: canConfirm ? 'pointer' : 'not-allowed', transition: 'background .15s',
            }}
          >
            {saving ? '처리 중...' : '폐기 확정'}
          </button>
        </div>
      </div>
    </div>
  )
}
