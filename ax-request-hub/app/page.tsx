'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const SURFACE = '#FFFFFF'
const BG      = '#F7F9FC'
const LINE    = '#E4E9F2'
const BLUE    = '#4A6FA5'
const TEXT    = '#18243D'
const MUTED   = '#8898BB'

const KPIs = [
  { key: 'activeEmployees',     label: 'AI 활용 직원',    icon: '👥', accent: '#10B981' },
  { key: 'monthlyTokens',       label: '이번달 토큰',     icon: '⚡', accent: '#4A6FA5', fmt: (v: number) => v.toLocaleString() },
  { key: 'pendingApplications', label: '심사 대기',        icon: '⏳', accent: '#B8956A' },
  { key: 'activeProjects',      label: '진행 중 AI 활용', icon: '🚀', accent: '#6B8FC9' },
]

const STATUS_LABEL: Record<string, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }
const PROJECT_STATUS: Record<string, string> = { submitted: '제출', evaluated: '평가완료', pilot: '파일럿', production: '운영중' }

export default function HomePage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: '#8898BB', fontSize: 14 }}>
      로딩 중...
    </div>
  )

  const trendMap: Record<string, number> = {}
  ;(data.applicationTrend || []).forEach((a: any) => {
    const day = new Date(a.createdAt).toISOString().slice(0, 10)
    trendMap[day] = (trendMap[day] || 0) + 1
  })
  const trendData = Object.entries(trendMap).sort().slice(-30).map(([date, count]) => ({ date: date.slice(5), count }))
  const serviceData = (data.serviceUsage || []).map((s: any) => ({ name: s.serviceName, tokens: s._sum?.tokenUsed ?? 0 }))

  const card: React.CSSProperties = { background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 4, padding: '18px 20px' }
  const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: MUTED }

  const leftStripe = (color: string): React.CSSProperties => ({
    borderLeft: `3px solid ${color}`,
    paddingLeft: 12,
  })

  return (
    <div style={{ color: TEXT, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#18243D', margin: 0 }}>운영 현황</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>삼성자산운용 AI 거버넌스 플랫폼</p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED, background: SURFACE, border: `1px solid ${LINE}`, padding: '6px 12px', borderRadius: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5B8C6E', display: 'inline-block' }} className="animate-pulse" />
          라이브
        </span>
      </div>

      {/* KPI 4개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {KPIs.map((kpi, i) => {
          const raw = data[kpi.key] ?? 0
          const val = kpi.fmt ? kpi.fmt(raw) : String(raw)
          return (
            <div key={kpi.label} style={{ ...card, ...leftStripe(kpi.accent), animationDelay: `${i * 80}ms` }} className="kpi-animate">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={label}>{kpi.label}</p>
                <span style={{ fontSize: 18 }}>{kpi.icon}</span>
              </div>
              <p style={{ fontSize: 30, fontWeight: 700, color: '#18243D', fontFamily: 'monospace', lineHeight: 1 }}>{val}</p>
              <div style={{ marginTop: 10, height: 3, background: `${kpi.accent}25`, borderRadius: 2 }}>
                <div style={{ height: 3, background: kpi.accent, borderRadius: 2, width: '60%' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* 차트 2개 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={card}>
          <p style={{ ...label, marginBottom: 16 }}>서비스별 이번달 토큰</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={serviceData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#F7F9FC', border: '1px solid #E4E9F2', borderRadius: 4, fontSize: 12, color: '#18243D' }} />
              <Bar dataKey="tokens" fill={BLUE} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <p style={{ ...label, marginBottom: 16 }}>최근 30일 AI 활용 신청 추이</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#F7F9FC', border: '1px solid #E4E9F2', borderRadius: 4, fontSize: 12, color: '#18243D' }} />
              <Line type="monotone" dataKey="count" stroke={BLUE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 테이블 2개 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* 레벨 신청 */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${LINE}` }}>
            <p style={label}>최근 리터러시 신청</p>
          </div>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1E3560', color: '#FFFFFF' }}>
                {['이름', '부서', '레벨', '상태', '신청일'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.recentApplications || []).map((a: any) => (
                <tr key={a.id} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: '9px 16px', color: TEXT, fontWeight: 500 }}>{a.employee?.name}</td>
                  <td style={{ padding: '9px 16px', color: MUTED }}>{a.employee?.department}</td>
                  <td style={{ padding: '9px 16px', fontFamily: 'monospace', color: BLUE, fontWeight: 700 }}>{a.requestedLevel}</td>
                  <td style={{ padding: '9px 16px' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 2, fontWeight: 600,
                      background: a.status === 'PENDING' ? 'rgba(184,149,106,.12)' : a.status === 'APPROVED' ? 'rgba(16,185,129,.10)' : 'rgba(185,64,64,.10)',
                      color:      a.status === 'PENDING' ? '#B8956A'               : a.status === 'APPROVED' ? '#059669'               : '#B94040',
                      border: `1px solid ${a.status === 'PENDING' ? 'rgba(184,149,106,.3)' : a.status === 'APPROVED' ? 'rgba(16,185,129,.3)' : 'rgba(185,64,64,.3)'}`,
                    }}>
                      {STATUS_LABEL[a.status] || a.status}
                    </span>
                  </td>
                  <td style={{ padding: '9px 16px', color: MUTED, fontSize: 12 }}>{new Date(a.createdAt).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI 활용 */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${LINE}` }}>
            <p style={label}>최근 AI 활용 신청</p>
          </div>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1E3560', color: '#FFFFFF' }}>
                {['제목', '부서', '점수', '상태'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.recentProjects || []).map((p: any) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: '9px 16px', color: TEXT, fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</td>
                  <td style={{ padding: '9px 16px', color: MUTED }}>{p.department}</td>
                  <td style={{ padding: '9px 16px', fontFamily: 'monospace', color: BLUE, fontWeight: 700 }}>{p.totalScore ?? '–'}</td>
                  <td style={{ padding: '9px 16px' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 2, fontWeight: 600, background: 'rgba(74,111,165,.10)', color: '#4A6FA5', border: '1px solid rgba(74,111,165,.25)' }}>
                      {PROJECT_STATUS[p.status] || p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
