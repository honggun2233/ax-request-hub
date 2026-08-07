'use client'
import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function UsagePage() {
  const [data, setData] = useState<any>(null)
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

  useEffect(() => {
    fetch('/api/usage').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  if (!data) return <div className="text-[var(--muted)] text-sm">로딩 중...</div>

  const records = data.usageRecords || []

  const serviceMap: Record<string, number> = {}
  records.forEach((r: any) => { serviceMap[r.service] = (serviceMap[r.service] || 0) + r.tokenUsed })
  const pieData = Object.entries(serviceMap).map(([name, value]) => ({ name, value }))

  const months = Array.from(new Set(records.map((r: any) => r.yearMonth as string))).sort().reverse() as string[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">사용량</h1>
        <select value={yearMonth} onChange={e => setYearMonth(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
          {months.length > 0 ? months.map(m => <option key={m} value={m}>{m}</option>) : <option value={yearMonth}>{yearMonth}</option>}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-[var(--muted)]">이번달 총 사용량</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{data.totalUsed?.toLocaleString() ?? 0}</p>
          <p className="text-xs text-[var(--muted)]">토큰</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-[var(--muted)]">한도</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{data.limit > 0 ? data.limit.toLocaleString() : '미설정'}</p>
          <p className="text-xs text-[var(--muted)]">토큰</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-[var(--muted)]">사용률</p>
          <p className={`text-2xl font-bold mt-1 ${data.usagePct >= 80 ? 'text-orange-500' : 'text-green-600'}`}>{data.usagePct}%</p>
          <p className="text-xs text-[var(--muted)]">한도 대비</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">서비스별 비중</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-[var(--muted)] text-sm text-center py-8">데이터 없음</p>}
        </div>
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">서비스별 사용량</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pieData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-[var(--muted)] text-sm text-center py-8">데이터 없음</p>}
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b"><h3 className="text-sm font-medium">서비스별 상세</h3></div>
        {records.length === 0 ? (
          <p className="text-[var(--muted)] text-sm p-4">이번 달 사용 기록이 없습니다</p>
        ) : (
          <div className="divide-y">
            {records.map((r: any) => (
              <div key={r.id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm capitalize">{r.service}</p>
                  {r.costKrw > 0 && <p className="text-xs text-[var(--muted)]">비용: ₩{r.costKrw.toLocaleString()}</p>}
                </div>
                <span className="font-semibold text-blue-600">{r.tokenUsed.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
