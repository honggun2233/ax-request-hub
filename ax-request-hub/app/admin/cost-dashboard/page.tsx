'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const TEXT  = '#18243D'
const MUTED = '#8898BB'
const BDR   = '#E4E9F2'
const CARD  = '#FFFFFF'
const SB    = '#F7F9FC'
const DIM   = '#BEC8DC'

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Claude (Anthropic)', openai: 'GPT (OpenAI)', gemini: 'Gemini (Google)', onprem: 'Qwen (On-Prem)',
}
const PROVIDER_COLOR: Record<string, string> = {
  anthropic: '#D97706', openai: '#10B981', gemini: '#4A6FA5', onprem: '#7C3AED',
}
const SERVICE_LABEL: Record<string, string> = {
  CLAUDE_ENTERPRISE: 'Claude Enterprise', GPT_CHAT: 'GPT (MS 365)', GEMINI: 'Gemini',
}

type DashData = {
  period: { from: string; to: string }
  summary: {
    totalCostKrw: number; totalTokens: number
    a: { costKrw: number; tokens: number; records: number }
    b: { costKrw: number; tokens: number; records: number }
    c: { costKrw: number; tokens: number; records: number }
  }
  aTrack: { byService: Record<string, { tokens: number; costKrw: number }> }
  bTrack: { byProvider: Record<string, { tokens: number; costKrw: number }>; byTask: Record<string, { tokens: number; costKrw: number; count: number }> }
  cTrack: { byProvider: Record<string, { tokens: number; costKrw: number }>; byAgent: Record<string, { tokens: number; costKrw: number; calls: number }> }
}

function KpiTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BDR}`, borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 160 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: accent ?? TEXT, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function TrackBar({ label, color, cost, total, tokens }: { label: string; color: string; cost: number; total: number; tokens: number }) {
  const pct = total > 0 ? Math.round(cost / total * 100) : 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT, marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span>{cost.toLocaleString()}원 ({pct}%)</span>
      </div>
      <div style={{ height: 8, background: BDR, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
      </div>
      <p style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{tokens.toLocaleString()} tokens</p>
    </div>
  )
}

function BreakdownTable({ title, rows, keyLabel }: {
  title: string
  rows: { key: string; tokens: number; costKrw: number; extra?: string }[]
  keyLabel: string
}) {
  if (rows.length === 0) return (
    <div style={{ background: CARD, border: `1px solid ${BDR}`, borderRadius: 8, padding: '14px 16px' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: DIM, marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 11, color: DIM, fontStyle: 'italic' }}>데이터 없음 (해당 기간 내)</p>
    </div>
  )
  return (
    <div style={{ background: CARD, border: `1px solid ${BDR}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${BDR}`, background: SB }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: DIM, margin: 0 }}>{title}</p>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: SB }}>
            <th style={{ padding: '8px 16px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11 }}>{keyLabel}</th>
            <th style={{ padding: '8px 16px', textAlign: 'right', color: MUTED, fontWeight: 600, fontSize: 11 }}>토큰</th>
            <th style={{ padding: '8px 16px', textAlign: 'right', color: MUTED, fontWeight: 600, fontSize: 11 }}>비용(원)</th>
            {rows[0]?.extra !== undefined && (
              <th style={{ padding: '8px 16px', textAlign: 'right', color: MUTED, fontWeight: 600, fontSize: 11 }}>건수</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} style={{ borderTop: i > 0 ? `1px solid ${BDR}` : 'none' }}>
              <td style={{ padding: '8px 16px', color: TEXT }}>{r.key}</td>
              <td style={{ padding: '8px 16px', textAlign: 'right', color: MUTED }}>{r.tokens.toLocaleString()}</td>
              <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: r.costKrw > 0 ? TEXT : DIM }}>
                {r.costKrw > 0 ? r.costKrw.toLocaleString() : '—'}
              </td>
              {r.extra !== undefined && (
                <td style={{ padding: '8px 16px', textAlign: 'right', color: MUTED }}>{r.extra}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CostDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const today    = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [from, setFrom] = useState(monthAgo)
  const [to, setTo]     = useState(today)
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cost-dashboard?from=${from}&to=${to}`)
      if (res.ok) setData(await res.json())
    } finally { setLoading(false) }
  }, [from, to])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') load()
  }, [status, load, router])

  const role = (session?.user as any)?.role
  if (status === 'loading') return null
  if (role !== 'AX_TEAM') return <p style={{ padding: 24, color: '#B94040' }}>AX팀 전용 페이지입니다.</p>

  const s = data?.summary

  return (
    <div style={{ color: TEXT, maxWidth: 960, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>AI 비용 통합 대시보드</h1>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>A-Track (Enterprise) · B-Track (AX Hub 엔진) · C-Track (배포 에이전트)</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ fontSize: 12, padding: '6px 10px', border: `1px solid ${BDR}`, borderRadius: 6, color: TEXT }} />
          <span style={{ color: DIM, fontSize: 12 }}>~</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ fontSize: 12, padding: '6px 10px', border: `1px solid ${BDR}`, borderRadius: 6, color: TEXT }} />
          <button onClick={load} disabled={loading}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', background: '#4A6FA5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? '로딩…' : '조회'}
          </button>
        </div>
      </div>

      {/* KPI 타일 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiTile label="전체 비용 합산" value={s ? `${s.totalCostKrw.toLocaleString()}원` : '—'} sub={s ? `${s.totalTokens.toLocaleString()} tokens` : undefined} accent="#18243D" />
        <KpiTile label="A-Track (Enterprise)" value={s ? `${s.a.costKrw.toLocaleString()}원` : '—'} sub={s ? `${s.a.records}건` : undefined} accent="#4A6FA5" />
        <KpiTile label="B-Track (AX Hub 엔진)" value={s ? `${s.b.costKrw.toLocaleString()}원` : '—'} sub={s ? `${s.b.records}건` : undefined} accent="#D97706" />
        <KpiTile label="C-Track (배포 에이전트)" value={s ? `${s.c.costKrw.toLocaleString()}원` : '—'} sub={s ? `${s.c.records}건` : undefined} accent="#7C3AED" />
      </div>

      {data && (
        <>
          {/* 트랙별 비중 바 */}
          <div style={{ background: CARD, border: `1px solid ${BDR}`, borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>트랙별 비용 비중</p>
            <TrackBar label="A-Track — Enterprise 사용량 집계" color="#4A6FA5" cost={data.summary.a.costKrw} total={data.summary.totalCostKrw} tokens={data.summary.a.tokens} />
            <TrackBar label="B-Track — AX Hub 엔진 직접 호출" color="#D97706" cost={data.summary.b.costKrw} total={data.summary.totalCostKrw} tokens={data.summary.b.tokens} />
            <TrackBar label="C-Track — 배포 에이전트 런타임 보고" color="#7C3AED" cost={data.summary.c.costKrw} total={data.summary.totalCostKrw} tokens={data.summary.c.tokens} />
          </div>

          {/* A-Track 세부 */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#4A6FA5', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>A-Track — Enterprise 서비스별</p>
            <BreakdownTable
              title="서비스별 집계 (Enterprise API Pull)"
              keyLabel="서비스"
              rows={Object.entries(data.aTrack.byService).map(([k, v]) => ({
                key: SERVICE_LABEL[k] ?? k,
                tokens: v.tokens,
                costKrw: Math.round(v.costKrw),
              }))}
            />
            {Object.keys(data.aTrack.byService).length === 0 && (
              <p style={{ fontSize: 11, color: '#D97706', background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.25)', borderRadius: 6, padding: '8px 12px', marginTop: 8 }}>
                ⚠ G-5 미착수 — Claude Enterprise Analytics API Primary Owner 키 필요. 데이터 없음.
              </p>
            )}
          </div>

          {/* B-Track 세부 */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>B-Track — AX Hub 엔진</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <BreakdownTable
                title="벤더별 집계"
                keyLabel="벤더"
                rows={Object.entries(data.bTrack.byProvider).map(([k, v]) => ({
                  key: PROVIDER_LABEL[k] ?? k,
                  tokens: v.tokens,
                  costKrw: Math.round(v.costKrw),
                }))}
              />
              <BreakdownTable
                title="태스크 유형별 집계"
                keyLabel="TaskType"
                rows={Object.entries(data.bTrack.byTask).map(([k, v]) => ({
                  key: k,
                  tokens: v.tokens,
                  costKrw: Math.round(v.costKrw),
                  extra: String(v.count),
                }))}
              />
            </div>
          </div>

          {/* C-Track 세부 */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>C-Track — 배포 에이전트 런타임</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <BreakdownTable
                title="벤더별 집계"
                keyLabel="벤더"
                rows={Object.entries(data.cTrack.byProvider).map(([k, v]) => ({
                  key: PROVIDER_LABEL[k] ?? k,
                  tokens: v.tokens,
                  costKrw: Math.round(v.costKrw),
                }))}
              />
              <BreakdownTable
                title="에이전트별 집계"
                keyLabel="에이전트"
                rows={Object.entries(data.cTrack.byAgent).map(([k, v]) => ({
                  key: k,
                  tokens: v.tokens,
                  costKrw: Math.round(v.costKrw),
                  extra: `${v.calls}회`,
                }))}
              />
            </div>
            {Object.keys(data.cTrack.byAgent).length === 0 && (
              <p style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
                배포된 에이전트가 ServiceToken으로 아직 사용량을 보고하지 않았습니다.
              </p>
            )}
          </div>

          {/* 범례 */}
          <div style={{ background: SB, border: `1px solid ${BDR}`, borderRadius: 8, padding: '12px 16px', fontSize: 11, color: MUTED }}>
            <p style={{ fontWeight: 700, color: DIM, marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>트랙 정의</p>
            <p>🅐 <strong>A-Track</strong>: Claude/GPT/Gemini Enterprise 계약 라이선스 소비 — 전 직원 직접 사용량, Enterprise Analytics API 수집 (G-5)</p>
            <p style={{ marginTop: 4 }}>🅑 <strong>B-Track</strong>: AX Hub 엔진이 내부 처리에 사용한 AI 비용 — Qwen 분류·평가·합성 등 <code>GatewayCallLog</code> 기록</p>
            <p style={{ marginTop: 4 }}>🅒 <strong>C-Track</strong>: 배포된 에이전트가 ServiceToken으로 자기 보고한 AI 사용량 — <code>AgentRuntimeUsage</code> 기록</p>
          </div>
        </>
      )}
    </div>
  )
}
