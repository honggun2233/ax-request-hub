'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function HomePage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  if (!data) return <div className="text-gray-400 text-sm">로딩 중...</div>

  const trendMap: Record<string, number> = {}
  ;(data.applicationTrend || []).forEach((a: any) => {
    const day = new Date(a.createdAt).toISOString().slice(0, 10)
    trendMap[day] = (trendMap[day] || 0) + 1
  })
  const trendData = Object.entries(trendMap).sort().slice(-30).map(([date, count]) => ({ date: date.slice(5), count }))

  const serviceData = (data.serviceUsage || []).map((s: any) => ({ name: s.serviceName, tokens: s._sum?.tokenUsed ?? 0 }))

  const STATUS_LABEL: Record<string, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }
  const PROJECT_STATUS: Record<string, string> = { submitted: '제출', evaluated: '평가완료', pilot: '파일럿', approved: '승인' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#0B1F3A]">운영 현황</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">AI 거버넌스 플랫폼 · 실시간 요약</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          라이브
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'AI 활용 직원',  value: data.activeEmployees,                       icon: '👥', accent: '#3B82F6' },
          { label: '이번달 토큰',   value: (data.monthlyTokens || 0).toLocaleString(), icon: '⚡', accent: '#10B981' },
          { label: '심사 대기',     value: data.pendingApplications,                   icon: '⏳', accent: '#F59E0B' },
          { label: '진행 중 AI 활용', value: data.activeProjects,                       icon: '🚀', accent: '#8B5CF6' },
        ].map((kpi, i) => (
          <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5 kpi-animate" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest">{kpi.label}</p>
              <span className="text-lg">{kpi.icon}</span>
            </div>
            <p className="text-3xl font-bold text-[#0B1F3A]">{kpi.value}</p>
            <div className="mt-3 h-0.5 rounded-full" style={{ background: `${kpi.accent}30` }}>
              <div className="h-0.5 rounded-full w-2/3" style={{ background: kpi.accent }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
          <h3 className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-4">서비스별 이번달 토큰</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={serviceData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: '12px' }} />
              <Bar dataKey="tokens" fill="#0B1F3A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-5">
          <h3 className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-4">최근 30일 레벨 신청 추이</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: '12px' }} />
              <Line type="monotone" dataKey="count" stroke="#C8A84B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <h3 className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest">최근 레벨 신청</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F6F3]">
                {['이름', '부서', '레벨', '상태', '신청일'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.recentApplications || []).map((a: any) => (
                <tr key={a.id} className="border-t border-[#F1F5F9] hover:bg-[#FAFAF9] transition-colors">
                  <td className="px-4 py-2.5 font-medium text-[#334155]">{a.employee?.name}</td>
                  <td className="px-4 py-2.5 text-[#94A3B8]">{a.employee?.department}</td>
                  <td className="px-4 py-2.5 font-mono text-[#0B1F3A] font-semibold">{a.requestedLevel}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${a.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-200' : a.status === 'APPROVED' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                      {STATUS_LABEL[a.status] || a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#94A3B8] text-xs">{new Date(a.createdAt).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <h3 className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest">최근 AI 활용</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F6F3]">
                {['제목', '부서', '점수', '상태'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.recentProjects || []).map((p: any) => (
                <tr key={p.id} className="border-t border-[#F1F5F9] hover:bg-[#FAFAF9] transition-colors">
                  <td className="px-4 py-2.5 truncate max-w-[130px] font-medium text-[#334155]">{p.title}</td>
                  <td className="px-4 py-2.5 text-[#94A3B8]">{p.department}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-[#0B1F3A]">{p.totalScore ?? '–'}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
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
