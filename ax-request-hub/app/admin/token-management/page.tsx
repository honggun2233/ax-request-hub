'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// ── 탭 정의 ─────────────────────────────────────────────
const TABS = ['AI 비용 통합', '토큰 현황', '서비스 배분', '부서 계정 할당'] as const

// ── 비용 대시보드 탭 ──────────────────────────────────────
const TEXT  = '#18243D'; const MUTED = '#8898BB'; const BDR = '#E4E9F2'; const CARD = '#FFFFFF'; const SB = '#F7F9FC'; const DIM = '#BEC8DC'
const PROVIDER_LABEL: Record<string, string> = { anthropic: 'Claude (Anthropic)', openai: 'GPT (OpenAI)', gemini: 'Gemini (Google)', onprem: 'Qwen (On-Prem)' }
const SERVICE_LABEL: Record<string, string> = { CLAUDE_ENTERPRISE: 'Claude Enterprise', GPT_CHAT: 'GPT (MS 365)', GEMINI: 'Gemini' }

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
        <span style={{ fontWeight: 600 }}>{label}</span><span>{cost.toLocaleString()}원 ({pct}%)</span>
      </div>
      <div style={{ height: 8, background: BDR, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
      </div>
      <p style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{tokens.toLocaleString()} tokens</p>
    </div>
  )
}

function BreakdownTable({ title, rows, keyLabel }: { title: string; rows: { key: string; tokens: number; costKrw: number; extra?: string }[]; keyLabel: string }) {
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
        <thead><tr style={{ background: SB }}>
          <th style={{ padding: '8px 16px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11 }}>{keyLabel}</th>
          <th style={{ padding: '8px 16px', textAlign: 'right', color: MUTED, fontWeight: 600, fontSize: 11 }}>토큰</th>
          <th style={{ padding: '8px 16px', textAlign: 'right', color: MUTED, fontWeight: 600, fontSize: 11 }}>비용(원)</th>
          {rows[0]?.extra !== undefined && <th style={{ padding: '8px 16px', textAlign: 'right', color: MUTED, fontWeight: 600, fontSize: 11 }}>건수</th>}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} style={{ borderTop: i > 0 ? `1px solid ${BDR}` : 'none' }}>
              <td style={{ padding: '8px 16px', color: TEXT }}>{r.key}</td>
              <td style={{ padding: '8px 16px', textAlign: 'right', color: MUTED }}>{r.tokens.toLocaleString()}</td>
              <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: r.costKrw > 0 ? TEXT : DIM }}>{r.costKrw > 0 ? r.costKrw.toLocaleString() : '—'}</td>
              {r.extra !== undefined && <td style={{ padding: '8px 16px', textAlign: 'right', color: MUTED }}>{r.extra}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CostDashboardPanel() {
  const today = new Date().toISOString().slice(0, 10)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(monthAgo); const [to, setTo] = useState(today)
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await fetch(`/api/admin/cost-dashboard?from=${from}&to=${to}`); if (res.ok) setData(await res.json()) }
    finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const s = data?.summary
  return (
    <div style={{ color: TEXT, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>AI 비용 통합 대시보드</h2>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>A-Track (Enterprise) · B-Track (AX Hub 엔진) · C-Track (배포 에이전트)</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ fontSize: 12, padding: '6px 10px', border: `1px solid ${BDR}`, borderRadius: 6, color: TEXT }} />
          <span style={{ color: DIM, fontSize: 12 }}>~</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ fontSize: 12, padding: '6px 10px', border: `1px solid ${BDR}`, borderRadius: 6, color: TEXT }} />
          <button onClick={load} disabled={loading} style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', background: '#4A6FA5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? '로딩…' : '조회'}</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <KpiTile label="전체 비용 합산" value={s ? `${s.totalCostKrw.toLocaleString()}원` : '—'} sub={s ? `${s.totalTokens.toLocaleString()} tokens` : undefined} accent="#18243D" />
        <KpiTile label="A-Track (Enterprise)" value={s ? `${s.a.costKrw.toLocaleString()}원` : '—'} sub={s ? `${s.a.records}건` : undefined} accent="#4A6FA5" />
        <KpiTile label="B-Track (AX Hub 엔진)" value={s ? `${s.b.costKrw.toLocaleString()}원` : '—'} sub={s ? `${s.b.records}건` : undefined} accent="#D97706" />
        <KpiTile label="C-Track (배포 에이전트)" value={s ? `${s.c.costKrw.toLocaleString()}원` : '—'} sub={s ? `${s.c.records}건` : undefined} accent="#7C3AED" />
      </div>
      {data && (
        <>
          <div style={{ background: CARD, border: `1px solid ${BDR}`, borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>트랙별 비용 비중</p>
            <TrackBar label="A-Track — Enterprise 사용량 집계" color="#4A6FA5" cost={data.summary.a.costKrw} total={data.summary.totalCostKrw} tokens={data.summary.a.tokens} />
            <TrackBar label="B-Track — AX Hub 엔진 직접 호출" color="#D97706" cost={data.summary.b.costKrw} total={data.summary.totalCostKrw} tokens={data.summary.b.tokens} />
            <TrackBar label="C-Track — 배포 에이전트 런타임 보고" color="#7C3AED" cost={data.summary.c.costKrw} total={data.summary.totalCostKrw} tokens={data.summary.c.tokens} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#4A6FA5', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>A-Track — Enterprise 서비스별</p>
            <BreakdownTable title="서비스별 집계" keyLabel="서비스" rows={Object.entries(data.aTrack.byService).map(([k, v]: any) => ({ key: SERVICE_LABEL[k] ?? k, tokens: v.tokens, costKrw: Math.round(v.costKrw) }))} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>B-Track — AX Hub 엔진</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <BreakdownTable title="벤더별 집계" keyLabel="벤더" rows={Object.entries(data.bTrack.byProvider).map(([k, v]: any) => ({ key: PROVIDER_LABEL[k] ?? k, tokens: v.tokens, costKrw: Math.round(v.costKrw) }))} />
              <BreakdownTable title="태스크 유형별 집계" keyLabel="TaskType" rows={Object.entries(data.bTrack.byTask).map(([k, v]: any) => ({ key: k, tokens: v.tokens, costKrw: Math.round(v.costKrw), extra: String(v.count) }))} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>C-Track — 배포 에이전트 런타임</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <BreakdownTable title="벤더별 집계" keyLabel="벤더" rows={Object.entries(data.cTrack.byProvider).map(([k, v]: any) => ({ key: PROVIDER_LABEL[k] ?? k, tokens: v.tokens, costKrw: Math.round(v.costKrw) }))} />
              <BreakdownTable title="에이전트별 집계" keyLabel="에이전트" rows={Object.entries(data.cTrack.byAgent).map(([k, v]: any) => ({ key: k, tokens: v.tokens, costKrw: Math.round(v.costKrw), extra: `${v.calls}회` }))} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── 토큰 현황 탭 ──────────────────────────────────────────
const TOKEN_SERVICES = ['Claude', 'GPT Enterprise', 'Gemini', 'all']
const TOKEN_LEVELS = ['L1', 'L2', 'L3', 'L4']
const _now = new Date()
const MONTHS = Array.from({ length: 6 }, (_, i) => { const d = new Date(_now.getFullYear(), _now.getMonth() - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })

function TokensPanel() {
  const { data: session, status } = useSession(); const router = useRouter()
  const [data, setData] = useState<any>({ policies: [], usageRecords: [], alerts: [], totalByService: {}, yearMonth: '' })
  const [usageForm, setUsageForm] = useState({ employeeId: '', service: 'openai', yearMonth: MONTHS[0], tokenUsed: '', costKrw: '' })
  const [policyForm, setPolicyForm] = useState({ scope: 'LEVEL', level: 'L1', service: 'all', monthlyLimit: '', singleCallLimit: '0', warningThreshold: '80' })
  const [employees, setEmployees] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [gatewayStatus, setGatewayStatus] = useState<any>(null)

  const load = () => {
    fetch('/api/admin/tokens').then(r => r.json()).then(setData)
    fetch('/api/admin/employees').then(r => r.json()).then(d => setEmployees(d.employees || []))
    fetch('/api/ai/status').then(r => r.ok ? r.json() : null).then(d => setGatewayStatus(d))
  }
  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); if (status === 'authenticated') load() }, [status])

  const submitUsage = async () => {
    if (!usageForm.employeeId || !usageForm.tokenUsed) { setMsg('직원과 사용량을 입력하세요'); return }
    await fetch('/api/admin/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upsert_usage', ...usageForm, tokenUsed: Number(usageForm.tokenUsed), costKrw: Number(usageForm.costKrw || 0) }) })
    setMsg('사용량 입력 완료'); load()
  }

  const submitPolicy = async () => {
    if (!policyForm.monthlyLimit) { setMsg('한도를 입력하세요'); return }
    await fetch('/api/admin/tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upsert_policy', ...policyForm, monthlyLimit: Number(policyForm.monthlyLimit), singleCallLimit: Number(policyForm.singleCallLimit), warningThreshold: Number(policyForm.warningThreshold) }) })
    setMsg('정책 저장 완료'); load()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-[#18243D]">토큰·비용 관리</h2>
      {msg && <div className="bg-blue-50 text-blue-800 rounded-lg p-3 text-sm">{msg}</div>}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E4E9F2]">
        <h3 className="font-semibold mb-4 text-[#18243D] flex items-center gap-2">AI 게이트웨이 상태<span className="text-xs font-normal text-[var(--muted)]">— API 키 설정 현황</span></h3>
        {!gatewayStatus ? <p className="text-sm text-[var(--muted)]">로딩 중...</p> : (
          <div className="flex gap-4 flex-wrap">
            {gatewayStatus.providers?.map((p: any) => (
              <div key={p.key} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm ${p.configured ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                <span className={`w-2 h-2 rounded-full ${p.configured ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="font-medium capitalize">{p.key}</span>
                <span>{p.configured ? '연결됨' : '미설정'}</span>
                {!p.configured && <span className="text-xs text-gray-400">({p.envVar})</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E4E9F2]">
          <h3 className="font-semibold mb-4 text-[#18243D]">월 사용량 수동 입력</h3>
          <div className="space-y-3">
            <div><label className="text-xs font-medium text-[var(--muted)] block mb-1">직원</label><select value={usageForm.employeeId} onChange={e => setUsageForm({ ...usageForm, employeeId: e.target.value })} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]"><option value="">직원 선택</option>{employees.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}</select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-medium text-[var(--muted)] block mb-1">서비스</label><select value={usageForm.service} onChange={e => setUsageForm({ ...usageForm, service: e.target.value })} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]">{TOKEN_SERVICES.filter(s => s !== 'all').map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="text-xs font-medium text-[var(--muted)] block mb-1">연월</label><select value={usageForm.yearMonth} onChange={e => setUsageForm({ ...usageForm, yearMonth: e.target.value })} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]">{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-medium text-[var(--muted)] block mb-1">토큰 사용량</label><input type="number" value={usageForm.tokenUsed} onChange={e => setUsageForm({ ...usageForm, tokenUsed: e.target.value })} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]" placeholder="예) 150000" /></div>
              <div><label className="text-xs font-medium text-[var(--muted)] block mb-1">비용 (₩, 선택)</label><input type="number" value={usageForm.costKrw} onChange={e => setUsageForm({ ...usageForm, costKrw: e.target.value })} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]" placeholder="예) 5000" /></div>
            </div>
            <button onClick={submitUsage} className="w-full bg-[#4A6FA5] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1E3560]">입력</button>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E4E9F2]">
          <h3 className="font-semibold mb-4 text-[#18243D]">한도 정책 설정</h3>
          <div className="space-y-3">
            <div><label className="text-xs font-medium text-[var(--muted)] block mb-1">Scope</label><select value={policyForm.scope} onChange={e => setPolicyForm({ ...policyForm, scope: e.target.value })} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]"><option value="COMPANY">회사 전체</option><option value="LEVEL">레벨별</option></select></div>
            {policyForm.scope === 'LEVEL' && <div><label className="text-xs font-medium text-[var(--muted)] block mb-1">레벨</label><select value={policyForm.level} onChange={e => setPolicyForm({ ...policyForm, level: e.target.value })} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]">{TOKEN_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-medium text-[var(--muted)] block mb-1">서비스</label><select value={policyForm.service} onChange={e => setPolicyForm({ ...policyForm, service: e.target.value })} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]">{TOKEN_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="text-xs font-medium text-[var(--muted)] block mb-1">월 한도 (토큰)</label><input type="number" value={policyForm.monthlyLimit} onChange={e => setPolicyForm({ ...policyForm, monthlyLimit: e.target.value })} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]" placeholder="예) 500000" /></div>
            </div>
            <div><label className="text-xs font-medium text-[var(--muted)] block mb-1">경고 임계값 (%)</label><input type="number" value={policyForm.warningThreshold} onChange={e => setPolicyForm({ ...policyForm, warningThreshold: e.target.value })} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]" /></div>
            <button onClick={submitPolicy} className="w-full bg-[#4A6FA5] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1E3560]">저장</button>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-[#E4E9F2]">
        <div className="flex justify-between items-center p-4 border-b border-[#E4E9F2]">
          <h3 className="font-semibold text-[#18243D]">{data.yearMonth} 사용량 현황</h3>
          <div className="flex gap-4 text-sm">{Object.entries(data.totalByService || {}).map(([s, t]: any) => <span key={s} className="text-[var(--muted)]"><span className="font-medium capitalize text-[#18243D]">{s}</span>: {t.toLocaleString()}</span>)}</div>
        </div>
        {data.usageRecords?.length === 0 ? <p className="text-sm text-[var(--muted)] p-4">이번 달 입력된 사용량이 없습니다</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F9FC] text-xs text-[var(--muted)]">
                <tr><th className="text-left px-4 py-3">직원</th><th className="text-left px-4 py-3">부서</th><th className="text-left px-4 py-3">레벨</th><th className="text-left px-4 py-3">서비스</th><th className="text-right px-4 py-3">토큰</th><th className="text-right px-4 py-3">비용(₩)</th></tr>
              </thead>
              <tbody className="divide-y divide-[#E4E9F2]">
                {data.usageRecords.map((r: any) => (
                  <tr key={r.id} className="hover:bg-[#F7F9FC]">
                    <td className="px-4 py-3 font-medium text-[#18243D]">{r.employee?.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{r.employee?.department}</td>
                    <td className="px-4 py-3 text-[#4A6FA5] font-medium">{r.employee?.currentLevel}</td>
                    <td className="px-4 py-3 capitalize text-[#18243D]">{r.service}</td>
                    <td className="px-4 py-3 text-right text-[#18243D]">{r.tokenUsed.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-[var(--muted)]">{r.costKrw > 0 ? `₩${r.costKrw.toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 서비스 배분 탭 ────────────────────────────────────────
const LEVEL_ORDER = ['L1', 'L2', 'L3', 'L4']

function DistributionPanel() {
  const { data: session, status } = useSession(); const router = useRouter()
  const [data, setData] = useState<any>({ policies: [], allocations: [] })
  const [newPolicy, setNewPolicy] = useState({ level: 'L1', serviceName: '', serviceDescription: '' })
  const [msg, setMsg] = useState('')

  const load = () => fetch('/api/admin/distribution').then(r => r.json()).then(setData)
  useEffect(() => { if (status === 'unauthenticated') router.push('/login'); if (status === 'authenticated') load() }, [status])

  const addPolicy = async () => {
    if (!newPolicy.serviceName) return
    await fetch('/api/admin/distribution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add_policy', ...newPolicy }) })
    setNewPolicy({ level: 'L1', serviceName: '', serviceDescription: '' }); load(); setMsg('정책 추가 완료')
  }

  const grouped = LEVEL_ORDER.reduce((acc: Record<string, any[]>, level) => {
    acc[level] = data.policies.filter((p: any) => p.level === level); return acc
  }, {})

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">서비스 배분 정책</h2>
      {msg && <div className="bg-blue-50 text-blue-800 rounded-lg p-3 mb-4 text-sm">{msg}</div>}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold mb-3">서비스 추가</h3>
        <div className="flex gap-3">
          <select value={newPolicy.level} onChange={e => setNewPolicy({ ...newPolicy, level: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">{LEVEL_ORDER.map(l => <option key={l} value={l}>{l}</option>)}</select>
          <input value={newPolicy.serviceName} onChange={e => setNewPolicy({ ...newPolicy, serviceName: e.target.value })} placeholder="서비스명" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <input value={newPolicy.serviceDescription} onChange={e => setNewPolicy({ ...newPolicy, serviceDescription: e.target.value })} placeholder="설명 (선택)" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <button onClick={addPolicy} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">추가</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {LEVEL_ORDER.map(level => (
          <div key={level} className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-bold text-blue-600 mb-3">{level}</h3>
            {grouped[level].length === 0 ? <p className="text-sm text-[var(--muted)]">서비스 없음</p> : (
              <div className="space-y-2">
                {grouped[level].map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center text-sm">
                    <span className={p.isActive ? '' : 'text-[var(--muted)] line-through'}>{p.serviceName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-[var(--muted)]'}`}>{p.isActive ? '활성' : '비활성'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-sm">
        <h3 className="font-semibold p-4 border-b">최근 발급 이력</h3>
        {data.allocations.length === 0 ? <p className="text-sm text-[var(--muted)] p-4">발급 이력 없음</p> : (
          <div className="divide-y">
            {data.allocations.map((a: any) => (
              <div key={a.id} className="p-4 flex justify-between items-center text-sm">
                <div><span className="font-medium">{a.employee?.name}</span><span className="text-[var(--muted)] ml-2">({a.employee?.department})</span><span className="ml-2 text-blue-600">{a.policy?.serviceName}</span></div>
                <div className="text-right text-xs text-[var(--muted)]"><p>{a.policy?.level}</p><p>{new Date(a.grantedAt).toLocaleDateString('ko-KR')}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 부서 계정 할당 탭 ─────────────────────────────────────
const TOOL_LABEL: Record<string, string> = { GPT_CHAT: 'ChatGPT (Chat)', GPT_EXCEL: 'ChatGPT (Excel)', GEMINI: 'Gemini Enterprise' }
const AI_DENSITY_LABEL: Record<string, string> = { HIGH: '높음 (AI 집약)', MEDIUM: '중간', STANDARD: '기본' }

function QuotaPanel() {
  const [quotas, setQuotas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ totalQuota: 0, managedBy: '', aiDensity: 'STANDARD' })
  const [newForm, setNewForm] = useState({ department: '', toolType: 'GPT_CHAT', totalQuota: 10, aiDensity: 'STANDARD', managedBy: '' })

  async function loadQuotas() { setLoading(true); const res = await fetch('/api/admin/tools/quota'); const data = await res.json(); setQuotas(data.quotas ?? []); setLoading(false) }
  useEffect(() => { loadQuotas() }, [])

  async function handleSaveEdit(id: string) {
    const res = await fetch('/api/admin/tools/quota', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...editForm }) })
    if (res.ok) { setEditing(null); loadQuotas() } else { const d = await res.json(); alert(d.error ?? '수정 실패') }
  }

  async function handleCreate() {
    if (!newForm.department.trim()) { alert('부서명을 입력하세요'); return }
    if (!newForm.managedBy.trim()) { alert('부서장 이메일을 입력하세요'); return }
    const res = await fetch('/api/admin/tools/quota', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newForm) })
    if (res.ok) { setNewForm({ department: '', toolType: 'GPT_CHAT', totalQuota: 10, aiDensity: 'STANDARD', managedBy: '' }); loadQuotas() } else { const d = await res.json(); alert(d.error ?? '생성 실패') }
  }

  const totalAllocated = quotas.reduce((s, q) => s + q.totalQuota, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">부서별 쿼터 설정</h2>
        <p className="text-sm text-[var(--muted)]">AI 도구 계정 쿼터를 부서별로 설정하고 부서장(관리 위임자)을 지정합니다. 총 배분: <strong>{totalAllocated}석</strong> / 계약 한도: 200석</p>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">전체 배분 현황</span>
          <span className={`text-sm font-bold ${totalAllocated > 200 ? 'text-red-500' : 'text-green-600'}`}>{totalAllocated} / 200석</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className={`h-3 rounded-full ${totalAllocated > 200 ? 'bg-red-500' : totalAllocated > 160 ? 'bg-yellow-400' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (totalAllocated / 200) * 100)}%` }} />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b"><tr>
            {['부서', '도구', '쿼터', '사용', 'AI 밀도', '부서장 이메일', ''].map(h => <th key={h} className="text-left p-4 font-medium text-gray-600">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading && <tr><td colSpan={7} className="p-8 text-center text-[var(--muted)]">로딩 중...</td></tr>}
            {!loading && quotas.map(q => (
              <tr key={q.id}>
                <td className="p-4 font-medium">{q.department}</td>
                <td className="p-4 text-gray-600">{TOOL_LABEL[q.toolType] ?? q.toolType}</td>
                <td className="p-4">{editing === q.id ? <input type="number" value={editForm.totalQuota} onChange={e => setEditForm(f => ({ ...f, totalQuota: Number(e.target.value) }))} className="w-16 border border-gray-200 rounded px-2 py-1 text-sm" min={0} /> : `${q.totalQuota}석`}</td>
                <td className="p-4 text-[var(--muted)]">{q.usedCount}석</td>
                <td className="p-4">{editing === q.id ? <select value={editForm.aiDensity} onChange={e => setEditForm(f => ({ ...f, aiDensity: e.target.value }))} className="border border-gray-200 rounded px-2 py-1 text-sm">{Object.entries(AI_DENSITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> : <span className="text-xs text-[var(--muted)]">{AI_DENSITY_LABEL[q.aiDensity] ?? q.aiDensity}</span>}</td>
                <td className="p-4">{editing === q.id ? <input type="email" value={editForm.managedBy} onChange={e => setEditForm(f => ({ ...f, managedBy: e.target.value }))} className="w-48 border border-gray-200 rounded px-2 py-1 text-sm" placeholder="dept-head@samsung.com" /> : <span className="text-xs text-[var(--muted)]">{q.managedBy || '미지정'}</span>}</td>
                <td className="p-4">{editing === q.id ? <div className="flex gap-2"><button onClick={() => handleSaveEdit(q.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">저장</button><button onClick={() => setEditing(null)} className="text-xs text-[var(--muted)] hover:underline">취소</button></div> : <button onClick={() => { setEditing(q.id); setEditForm({ totalQuota: q.totalQuota, managedBy: q.managedBy, aiDensity: q.aiDensity }) }} className="text-xs text-blue-600 hover:underline">수정</button>}</td>
              </tr>
            ))}
            {!loading && quotas.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-[var(--muted)]">등록된 쿼터가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-semibold mb-4">새 쿼터 추가</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">부서명</label><input type="text" value={newForm.department} onChange={e => setNewForm(f => ({ ...f, department: e.target.value }))} placeholder="운용본부" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">도구</label><select value={newForm.toolType} onChange={e => setNewForm(f => ({ ...f, toolType: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">{Object.entries(TOOL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">쿼터 (석)</label><input type="number" value={newForm.totalQuota} onChange={e => setNewForm(f => ({ ...f, totalQuota: Number(e.target.value) }))} min={1} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">AI 밀도</label><select value={newForm.aiDensity} onChange={e => setNewForm(f => ({ ...f, aiDensity: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">{Object.entries(AI_DENSITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="md:col-span-2"><label className="block text-xs font-medium text-gray-600 mb-1">부서장 이메일</label><input type="email" value={newForm.managedBy} onChange={e => setNewForm(f => ({ ...f, managedBy: e.target.value }))} placeholder="dept-head@samsung.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
        </div>
        <button onClick={handleCreate} className="mt-4 bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-blue-700 transition">쿼터 추가</button>
      </div>
    </div>
  )
}

// ── 메인 페이지 ─────────────────────────────────────────
export default function TokenManagementPage() {
  const [activeTab, setActiveTab] = useState<number>(0)

  return (
    <div className="space-y-0">
      {/* 탭 헤더 */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === i
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-[var(--muted)] hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 — 조건부 마운트로 불필요한 API 호출 방지 */}
      {activeTab === 0 && <CostDashboardPanel />}
      {activeTab === 1 && <TokensPanel />}
      {activeTab === 2 && <DistributionPanel />}
      {activeTab === 3 && <QuotaPanel />}
    </div>
  )
}
