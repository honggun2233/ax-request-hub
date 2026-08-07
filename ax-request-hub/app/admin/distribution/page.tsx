"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const LEVEL_ORDER = ["L1", "L2", "L3", "L4"]

export default function AdminDistributionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>({ policies: [], allocations: [] })
  const [newPolicy, setNewPolicy] = useState({ level: "L1", serviceName: "", serviceDescription: "" })
  const [msg, setMsg] = useState("")

  const load = () => fetch("/api/admin/distribution").then(r => r.json()).then(setData)
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") load()
  }, [status])

  const addPolicy = async () => {
    if (!newPolicy.serviceName) return
    await fetch("/api/admin/distribution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_policy", ...newPolicy }),
    })
    setNewPolicy({ level: "L1", serviceName: "", serviceDescription: "" })
    load(); setMsg("정책 추가 완료")
  }

  const grouped = LEVEL_ORDER.reduce((acc: Record<string, any[]>, level) => {
    acc[level] = data.policies.filter((p: any) => p.level === level)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6"><a href="/admin" className="text-sm text-[var(--muted)] hover:underline">← 관리 포털</a></div>
        <h1 className="text-2xl font-bold mb-6">서비스 배분 정책</h1>
        {msg && <div className="bg-blue-50 text-blue-800 rounded-lg p-3 mb-4 text-sm">{msg}</div>}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold mb-3">서비스 추가</h2>
          <div className="flex gap-3">
            <select value={newPolicy.level} onChange={e => setNewPolicy({ ...newPolicy, level: e.target.value })} className="border rounded-lg px-3 py-2 text-sm">
              {LEVEL_ORDER.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <input value={newPolicy.serviceName} onChange={e => setNewPolicy({ ...newPolicy, serviceName: e.target.value })} placeholder="서비스명" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            <input value={newPolicy.serviceDescription} onChange={e => setNewPolicy({ ...newPolicy, serviceDescription: e.target.value })} placeholder="설명 (선택)" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            <button onClick={addPolicy} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">추가</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {LEVEL_ORDER.map(level => (
            <div key={level} className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-blue-600 mb-3">{level}</h3>
              {grouped[level].length === 0 ? (
                <p className="text-sm text-[var(--muted)]">서비스 없음</p>
              ) : (
                <div className="space-y-2">
                  {grouped[level].map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center text-sm">
                      <span className={p.isActive ? "" : "text-[var(--muted)] line-through"}>{p.serviceName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-[var(--muted)]"}`}>{p.isActive ? "활성" : "비활성"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          <h2 className="font-semibold p-4 border-b">최근 발급 이력</h2>
          {data.allocations.length === 0 ? (
            <p className="text-sm text-[var(--muted)] p-4">발급 이력 없음</p>
          ) : (
            <div className="divide-y">
              {data.allocations.map((a: any) => (
                <div key={a.id} className="p-4 flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{a.employee?.name}</span>
                    <span className="text-[var(--muted)] ml-2">({a.employee?.department})</span>
                    <span className="ml-2 text-blue-600">{a.policy?.serviceName}</span>
                  </div>
                  <div className="text-right text-xs text-[var(--muted)]">
                    <p>{a.policy?.level}</p>
                    <p>{new Date(a.grantedAt).toLocaleDateString("ko-KR")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
