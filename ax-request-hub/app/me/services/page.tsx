"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  REVOKED: "bg-gray-100 text-gray-600",
  EXPIRED: "bg-red-100 text-red-700",
}
const STATUS_LABEL: Record<string, string> = { ACTIVE: "사용중", REVOKED: "회수됨", EXPIRED: "만료" }

export default function MyServicesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [allocations, setAllocations] = useState<any[]>([])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    fetch("/api/services").then(r => r.json()).then(setAllocations)
  }, [status])

  const active = allocations.filter(a => a.status === "ACTIVE")
  const inactive = allocations.filter(a => a.status !== "ACTIVE")

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6"><a href="/me" className="text-sm text-gray-500 hover:underline">← 내 현황</a></div>
        <h1 className="text-2xl font-bold mb-6">배분 서비스</h1>

        {active.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <p className="text-gray-500 mb-2">배분된 AI 서비스가 없습니다</p>
            <p className="text-sm text-gray-400">AI 레벨 신청 후 AX팀 심사가 완료되면 서비스가 배분됩니다</p>
            <a href="/me/level" className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">레벨 신청하기</a>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {active.map((a: any) => (
              <div key={a.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{a.policy?.serviceName}</p>
                    <p className="text-xs text-gray-500 mt-1">레벨 {a.policy?.level} · 발급: {new Date(a.grantedAt).toLocaleDateString("ko-KR")}</p>
                    {a.accountInfo && <p className="text-xs text-gray-600 mt-1">계정: {a.accountInfo}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {inactive.length > 0 && (
          <div>
            <h2 className="font-medium text-gray-500 text-sm mb-3">이전 서비스</h2>
            <div className="space-y-2">
              {inactive.map((a: any) => (
                <div key={a.id} className="bg-white rounded-xl p-3 shadow-sm opacity-60">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">{a.policy?.serviceName}</p>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
