"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function MyUsagePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>({ usageRecords: [], totalUsed: 0, limit: 0, usagePct: 0, yearMonth: "", alerts: [] })

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    fetch("/api/usage").then(r => r.json()).then(setData)
  }, [status])

  const barColor = data.usagePct >= 100 ? "bg-red-500" : data.usagePct >= 80 ? "bg-yellow-500" : "bg-blue-500"

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6"><a href="/me" className="text-sm text-gray-500 hover:underline">← 내 현황</a></div>
        <h1 className="text-2xl font-bold mb-2">토큰 사용량</h1>
        <p className="text-sm text-gray-500 mb-6">{data.yearMonth} 기준</p>

        {data.alerts?.length > 0 && (
          <div className={`rounded-xl p-4 mb-4 ${data.usagePct >= 100 ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800"}`}>
            ⚠️ 월 한도의 {data.usagePct}%를 사용했습니다. {data.usagePct >= 100 ? "한도를 초과했습니다." : "AX팀에 한도 증설을 문의하세요."}
          </div>
        )}

        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">이번 달 총 사용량</span>
            <span className="text-sm text-gray-500">{data.usagePct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(data.usagePct, 100)}%` }} />
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>{data.totalUsed.toLocaleString()} 토큰</span>
            <span>한도 {data.limit > 0 ? `${data.limit.toLocaleString()} 토큰` : "미설정"}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          <h2 className="font-semibold p-4 border-b">서비스별 사용량</h2>
          {data.usageRecords?.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">이번 달 사용 기록이 없습니다</p>
          ) : (
            <div className="divide-y">
              {data.usageRecords.map((r: any) => (
                <div key={r.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm capitalize">{r.service}</p>
                    {r.costKrw > 0 && <p className="text-xs text-gray-500">비용: ₩{r.costKrw.toLocaleString()}</p>}
                  </div>
                  <span className="font-semibold text-blue-600">{r.tokenUsed.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
