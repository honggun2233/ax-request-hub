"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

const SURFACE = '#FFFFFF'
const BG      = '#F7F9FC'
const LINE    = '#E4E9F2'
const BLUE    = '#4A6FA5'
const GOLD    = '#B8956A'
const NAVY    = '#1E3560'
const TEXT    = '#18243D'
const MUTED   = '#8898BB'
const DIM     = '#BEC8DC'

const STEPS = ['신청', '심사', '승인', '개발', '운영']

const STATUS_INFO: Record<string, { label: string; step: number; color: string }> = {
  submitted:  { label: '심사 중',     step: 1, color: '#D97706' },
  evaluated:  { label: '검토 완료',   step: 2, color: BLUE },
  pilot:      { label: '파일럿 승인', step: 3, color: '#059669' },
  production: { label: '운영 중',     step: 4, color: '#059669' },
  closed:     { label: '종료',        step: 0, color: MUTED },
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginTop: 12 }}>
      {STEPS.map((s, i) => {
        const done    = i < step
        const current = i === step
        return (
          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ flex: 1, height: 1, background: done ? 'rgba(184,149,106,.45)' : LINE }} />}
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: done ? GOLD : current ? 'rgba(184,149,106,.35)' : DIM,
                border: current ? `2px solid ${GOLD}` : 'none',
              }} />
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: done ? 'rgba(184,149,106,.45)' : LINE }} />}
            </div>
            <span style={{ fontSize: 9, color: done || current ? GOLD : MUTED, marginTop: 4, letterSpacing: '.04em' }}>{s}</span>
          </div>
        )
      })}
    </div>
  )
}

function HandoverRequestRow({ projectId, projectTitle, onSuccess }: { projectId: string; projectTitle: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [demoUrl, setDemoUrl] = useState('')
  const [inputOutputSpec, setInputOutputSpec] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [dataClassification, setDataClassification] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputBase: React.CSSProperties = { width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #E4E9F2', borderRadius: 4, boxSizing: 'border-box' }

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setSubmitting(true); setError(null)
    try {
      const artifacts = { demoUrl, inputOutputSpec, repoUrl, dataClassification }
      const res = await fetch(`/api/projects/${projectId}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, artifacts }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '요청 실패')
      setOpen(false)
      onSuccess()
    } catch (e: any) {
      setError(e.message)
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ marginTop: 8, paddingLeft: 2 }}>
      {!open && (
        <button onClick={() => setOpen(true)} style={{
          fontSize: 11, color: '#059669', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 600,
        }}>
          + 인수 신청 (PoC 완료 → AX팀 정식 검토 요청)
        </button>
      )}
      {open && (
        <form onSubmit={submit} style={{
          background: 'rgba(5,150,105,.06)', border: '1px solid rgba(5,150,105,.25)',
          borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#059669', margin: 0 }}>인수 신청 — {projectTitle}</p>
          <p style={{ fontSize: 10, color: MUTED, margin: 0 }}>AI-STD-2026-006 Phase 1 완료 기준 제출물을 입력하세요.</p>
          <div>
            <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 3 }}>기능 시연 링크/설명 *</label>
            <input required value={demoUrl} onChange={e => setDemoUrl(e.target.value)}
              placeholder="https://... 또는 시연 설명" style={inputBase} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 3 }}>입출력 명세 문서 링크 *</label>
            <input required value={inputOutputSpec} onChange={e => setInputOutputSpec(e.target.value)}
              placeholder="https://..." style={inputBase} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 3 }}>버전 관리 저장소 URL *</label>
            <input required value={repoUrl} onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/..." style={inputBase} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 3 }}>기밀등급 명시 문서 링크 *</label>
            <input required value={dataClassification} onChange={e => setDataClassification(e.target.value)}
              placeholder="https://... 또는 설명" style={inputBase} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: MUTED, display: 'block', marginBottom: 3 }}>인수 메모 (선택)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={2} placeholder="추가 전달 사항"
              style={{ ...inputBase, resize: 'none' }} />
          </div>
          {error && <p style={{ fontSize: 11, color: '#B94040', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setOpen(false)} style={{
              flex: 1, padding: '7px', background: 'none', border: '1px solid #E4E9F2', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: MUTED,
            }}>취소</button>
            <button type="submit" disabled={submitting} style={{
              flex: 2, padding: '7px', background: '#059669', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? .6 : 1,
            }}>{submitting ? '신청 중…' : '인수 신청하기'}</button>
          </div>
        </form>
      )}
    </div>
  )
}

function PocRequestRow({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [agentId, setAgentId] = useState('')
  const [sandboxEnv, setSandboxEnv] = useState('')
  const [requestReason, setRequestReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    if (!agentId || !requestReason) return
    setSubmitting(true); setResult(null)
    try {
      const res = await fetch(`/api/registry/${agentId}/sandbox-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandboxEnv, requestReason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '요청 실패')
      setResult({ ok: true, msg: json.message })
      setOpen(false)
    } catch (e: any) {
      setResult({ ok: false, msg: e.message })
    } finally { setSubmitting(false) }
  }

  const inputBase: React.CSSProperties = { width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #E4E9F2', borderRadius: 4, boxSizing: 'border-box' }

  return (
    <div style={{ marginTop: -6, marginBottom: 4, paddingLeft: 2 }}>
      {!open && (
        <button onClick={() => setOpen(true)} style={{
          fontSize: 11, color: '#4F46E5', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 600,
        }}>
          + 샌드박스 PoC 요청 (GATE2 에이전트 연결)
        </button>
      )}
      {result && !open && (
        <p style={{ fontSize: 11, color: result.ok ? '#059669' : '#B94040', margin: '2px 0 0' }}>{result.msg}</p>
      )}
      {open && (
        <form onSubmit={submit} style={{
          background: 'rgba(79,70,229,.06)', border: '1px solid rgba(79,70,229,.2)',
          borderRadius: 6, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', margin: 0 }}>샌드박스 PoC 요청</p>
          <p style={{ fontSize: 10, color: '#8898BB', margin: 0 }}>/registry에서 GATE2 상태 에이전트 ID를 확인 후 입력하세요.</p>
          <div>
            <label style={{ fontSize: 10, color: '#8898BB', display: 'block', marginBottom: 3 }}>에이전트 ID (AgentRegistry ID) *</label>
            <input required value={agentId} onChange={e => setAgentId(e.target.value)}
              placeholder="cuid 형식 ID" style={inputBase} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#8898BB', display: 'block', marginBottom: 3 }}>샌드박스 환경 (선택)</label>
            <input value={sandboxEnv} onChange={e => setSandboxEnv(e.target.value)}
              placeholder="예: aws-landingzone-sandbox-01" style={inputBase} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#8898BB', display: 'block', marginBottom: 3 }}>요청 사유 *</label>
            <textarea required value={requestReason} onChange={e => setRequestReason(e.target.value)}
              rows={2} placeholder="PoC를 통해 검증하려는 내용"
              style={{ ...inputBase, resize: 'none' }} />
          </div>
          {result && <p style={{ fontSize: 11, color: '#B94040', margin: 0 }}>{result.msg}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setOpen(false)} style={{
              flex: 1, padding: '7px', background: 'none', border: '1px solid #E4E9F2', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: '#8898BB',
            }}>취소</button>
            <button type="submit" disabled={submitting} style={{
              flex: 2, padding: '7px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              {submitting ? '제출 중...' : 'PoC 요청 제출'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function MyProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = () => {
    fetch("/api/projects?mine=1")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadProjects() }, []);

  return (
    <div style={{ color: TEXT, maxWidth: 720, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: 0 }}>내 AI 활용</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>신청한 AI 활용의 진행 현황을 확인하세요.</p>
        </div>
        <Link href="/projects/new" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 600, color: '#ffffff',
          background: BLUE, border: `1px solid ${BLUE}`,
          padding: '7px 14px', borderRadius: 4, textDecoration: 'none',
        }}>
          <Plus size={14} /> AI 활용 신청
        </Link>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: MUTED, fontSize: 13 }}>불러오는 중…</div>
      )}

      {!loading && projects.length === 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 4, padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: 16 }}>아직 신청한 AI 활용이 없습니다.</p>
          <Link href="/projects/new" style={{ fontSize: 13, color: '#ffffff', background: BLUE, padding: '8px 16px', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>
            AI 활용 신청하기
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {projects.map((p) => {
          const info = STATUS_INFO[p.status] ?? { label: p.status, step: 0, color: MUTED }
          return (
            <div key={p.id}>
              <Link href={`/status/${p.id}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 4, padding: '16px 20px', cursor: 'pointer', transition: 'border-color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74,111,165,.35)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = LINE)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, flex: 1, lineHeight: 1.4, margin: 0 }}>
                      {p.title}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {p.pendingAppeal && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 2, color: GOLD, background: 'rgba(184,149,106,.12)', border: '1px solid rgba(184,149,106,.3)' }}>
                          이의제기
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 2, color: info.color, background: `${info.color}1A`, border: `1px solid ${info.color}4D` }}>
                        {info.label}
                      </span>
                    </div>
                  </div>
                  <ProgressBar step={info.step} />
                  <p style={{ fontSize: 11, color: MUTED, marginTop: 10 }}>
                    신청일 {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                    {p.department && <span style={{ marginLeft: 10 }}>· {p.department}</span>}
                  </p>
                </div>
              </Link>
              {['pilot', 'production'].includes(p.status) && <PocRequestRow projectId={p.id} />}
              {p.status === 'pilot' && !p.handoverRequestedAt && (
                <HandoverRequestRow projectId={p.id} projectTitle={p.title} onSuccess={loadProjects} />
              )}
              {p.handoverRequestedAt && (
                <div style={{ fontSize: 11, color: '#059669', marginTop: 8, paddingLeft: 2 }}>
                  ✓ 인수 신청 완료 ({new Date(p.handoverRequestedAt).toLocaleDateString('ko-KR')})
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
}
