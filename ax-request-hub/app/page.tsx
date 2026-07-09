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
      <h1 className="text-xl font-bold text-gray-900">홈 대시보드</h1>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'AI 활용 직원', value: data.activeEmployees, color: 'text-blue-600' },
          { label: '이번달 토큰', value: (data.monthlyTokens || 0).toLocaleString(), color: 'text-green-600' },
          { label: '심사 대기', value: data.pendingApplications, color: 'text-orange-500' },
          { label: '진행 중 과제', value: data.activeProjects, color: 'text-purple-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">서비스별 이번달 토큰</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={serviceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="tokens" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">최근 30일 레벨 신청 추이</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b"><h3 className="text-sm font-medium">최근 레벨 신청</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['이름', '부서', '신청레벨', '상태', '신청일'].map(h => <th key={h} className="px-3 py-2 text-left text-gray-500 text-xs">{h}</th>)}</tr></thead>
            <tbody>
              {(data.recentApplications || []).map((a: any) => (
                <tr key={a.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{a.employee?.name}</td>
                  <td className="px-3 py-2 text-gray-500">{a.employee?.department}</td>
                  <td className="px-3 py-2">{a.requestedLevel}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${a.status === 'PENDING' ? 'bg-orange-100 text-orange-700' : a.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{STATUS_LABEL[a.status] || a.status}</span></td>
                  <td className="px-3 py-2 text-gray-400">{new Date(a.createdAt).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-3 border-b"><h3 className="text-sm font-medium">최근 과제</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['제목', '부서', '점수', '상태'].map(h => <th key={h} className="px-3 py-2 text-left text-gray-500 text-xs">{h}</th>)}</tr></thead>
            <tbody>
              {(data.recentProjects || []).map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 truncate max-w-[120px]">{p.title}</td>
                  <td className="px-3 py-2 text-gray-500">{p.department}</td>
                  <td className="px-3 py-2">{p.totalScore ?? '-'}</td>
                  <td className="px-3 py-2"><span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{PROJECT_STATUS[p.status] || p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
