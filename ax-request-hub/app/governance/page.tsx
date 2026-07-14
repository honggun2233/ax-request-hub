'use client'
import { useState, useEffect } from 'react'

export default function GovernancePage() {
  const [data, setData] = useState<any>({ logs: [], stats: [] })
  const [entityType, setEntityType] = useState('')

  useEffect(() => {
    const q = entityType ? `?entityType=${entityType}` : ''
    fetch(`/api/governance${q}`).then(r => r.json()).then(setData).catch(() => {})
  }, [entityType])

  const types = Array.from(new Set((data.logs || []).map((l: any) => l.entityType)))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">감사 로그</h1>
      <div className="grid grid-cols-3 gap-4">
        {(data.stats || []).slice(0, 3).map((s: any) => (
          <div key={s.entityType} className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">{s.entityType}</p>
            <p className="text-2xl font-bold text-gray-800">{typeof s._count === 'object' ? s._count._all ?? 0 : s._count}</p>
          </div>
        ))}
        {(data.stats || []).length === 0 && (
          <div className="col-span-3 bg-white rounded-lg border p-4 text-center text-gray-400 text-sm">
            감사 로그 데이터 없음
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <select value={entityType} onChange={e => setEntityType(e.target.value)} className="border rounded px-3 py-1.5 text-sm">
          <option value="">전체 유형</option>
          {types.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b"><h3 className="text-sm font-medium">감사 로그 ({data.logs?.length ?? 0}건)</h3></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{['시간', '유형', '액션', '대상 ID', '실행자', '상세'].map(h => <th key={h} className="px-3 py-2 text-left text-xs text-gray-500">{h}</th>)}</tr></thead>
          <tbody>
            {(data.logs || []).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">로그 없음</td></tr>}
            {(data.logs || []).map((l: any) => (
              <tr key={l.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-400 text-xs">{new Date(l.createdAt).toLocaleString('ko-KR')}</td>
                <td className="px-3 py-2"><span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{l.entityType}</span></td>
                <td className="px-3 py-2 font-medium">{l.action}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{l.entityId.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-gray-500">{l.actorEmail}</td>
                <td className="px-3 py-2 text-gray-400 truncate max-w-[200px]">{l.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
