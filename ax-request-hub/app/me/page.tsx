'use client'
import { useState, useEffect } from 'react'

const LEVEL_BADGE: Record<string, string> = {
  L0: 'bg-gray-100 text-gray-600', L1: 'bg-blue-100 text-blue-700',
  L2: 'bg-green-100 text-green-700', L3: 'bg-orange-100 text-orange-700', L4: 'bg-purple-100 text-purple-700',
}

export default function MePage() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch('/api/me/summary').then(r => r.json()).then(setData).catch(() => {}) }, [])
  if (!data || data.error) return <div className="text-gray-400">로딩 중...</div>

  const { employee, services, tokenUsed, tokenLimit, recentApplications } = data
  const pct = tokenLimit > 0 ? Math.min((tokenUsed / tokenLimit) * 100, 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">나의 현황</h1>
        <span className={`px-3 py-1 rounded-full font-bold ${LEVEL_BADGE[employee?.currentLevel ?? 'L0']}`}>{employee?.currentLevel ?? 'L0'}</span>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">이번달 토큰 사용량</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-3">
            <div className={`h-3 rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm text-gray-600">{tokenUsed.toLocaleString()} / {tokenLimit.toLocaleString()}</span>
        </div>
        {pct >= 80 && <p className="text-xs text-orange-600 mt-1">한도의 {pct.toFixed(0)}% 사용 중</p>}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">배분된 서비스 ({services?.length ?? 0}개)</h2>
        <div className="grid grid-cols-3 gap-3">
          {(services || []).map((s: any) => (
            <div key={s.id} className="bg-white border rounded-lg p-3">
              <p className="font-medium text-sm">{s.serviceName}</p>
              <p className="text-xs text-gray-400 mt-1">배분일: {new Date(s.createdAt).toLocaleDateString('ko-KR')}</p>
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 mt-2 inline-block">활성</span>
            </div>
          ))}
          {(!services || services.length === 0) && <p className="text-gray-400 text-sm col-span-3">배분된 서비스 없음 — 레벨 신청 후 AX팀 문의</p>}
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b"><h3 className="text-sm font-medium">레벨 신청 이력</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{['신청레벨', '상태', '신청일', '처리일'].map(h => <th key={h} className="px-4 py-2 text-left text-xs text-gray-500">{h}</th>)}</tr></thead>
          <tbody>
            {(recentApplications || []).map((a: any) => (
              <tr key={a.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{a.requestedLevel}</td>
                <td className="px-4 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${a.status === 'PENDING' ? 'bg-orange-100 text-orange-700' : a.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{a.status}</span></td>
                <td className="px-4 py-2 text-gray-400">{new Date(a.createdAt).toLocaleDateString('ko-KR')}</td>
                <td className="px-4 py-2 text-gray-400">{a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('ko-KR') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
