"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const SERVICES = ["openai", "claude", "gemini", "all"]
const LEVELS = ["L1", "L2", "L3", "L4"]
const MONTHS = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(); d.setMonth(d.getMonth() - i)
  return d.toISOString().slice(0, 7)
})

export default function AdminTokensPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>({ policies: [], usageRecords: [], alerts: [], totalByService: {}, yearMonth: "" })
  const [usageForm, setUsageForm] = useState({ employeeId: "", service: "openai", yearMonth: MONTHS[0], tokenUsed: "", costKrw: "" })
  const [policyForm, setPolicyForm] = useState({ scope: "LEVEL", level: "L1", service: "all", monthlyLimit: "", singleCallLimit: "0", warningThreshold: "80" })
  const [employees, setEmployees] = useState<any[]>([])
  const [msg, setMsg] = useState("")

  const load = () => {
    fetch("/api/admin/tokens").then(r => r.json()).then(setData)
    fetch("/api/admin/employees").then(r => r.json()).then(d => setEmployees(d.employees || []))
  }
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") load()
  }, [status])

  const submitUsage = async () => {
    if (!usageForm.employeeId || !usageForm.tokenUsed) { setMsg("직원과 사용량을 입력하세요"); return }
    await fetch("/api/admin/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert_usage", ...usageForm, tokenUsed: Number(usageForm.tokenUsed), costKrw: Number(usageForm.costKrw || 0) }),
    })
    setMsg("사용량 입력 완료"); load()
  }

  const submitPolicy = async () => {
    if (!policyForm.monthlyLimit) { setMsg("한도를 입력하세요"); return }
    await fetch("/api/admin/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert_policy", ...policyForm, monthlyLimit: Number(policyForm.monthlyLimit), singleCallLimit: Number(policyForm.singleCallLimit), warningThreshold: Number(policyForm.warningThreshold) }),
    })
    setMsg("정책 저장 완료"); load()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6"><a href="/admin" className="text-sm text-gray-500 hover:underline">← 관리 포털</a></div>
        <h1 className="text-2xl font-bold mb-6">토큰·비용 관리</h1>
        {msg && <div className="bg-blue-50 text-blue-800 rounded-lg p-3 mb-4 text-sm">{msg}</div>}

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">월 사용량 수동 입력</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">직원</label>
                <select value={usageForm.employeeId} onChange={e => setUsageForm({ ...usageForm, employeeId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">직원 선택</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">서비스</label>
                  <select value={usageForm.service} onChange={e => setUsageForm({ ...usageForm, service: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {SERVICES.filter(s => s !== "all").map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">연월</label>
                  <select value={usageForm.yearMonth} onChange={e => setUsageForm({ ...usageForm, yearMonth: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">토큰 사용량</label>
                  <input type="number" value={usageForm.tokenUsed} onChange={e => setUsageForm({ ...usageForm, tokenUsed: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예) 150000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">비용 (₩, 선택)</label>
                  <input type="number" value={usageForm.costKrw} onChange={e => setUsageForm({ ...usageForm, costKrw: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예) 5000" />
                </div>
              </div>
              <button onClick={submitUsage} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium">입력</button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">한도 정책 설정</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Scope</label>
                <select value={policyForm.scope} onChange={e => setPolicyForm({ ...policyForm, scope: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="COMPANY">회사 전체</option>
                  <option value="LEVEL">레벨별</option>
                </select>
              </div>
              {policyForm.scope === "LEVEL" && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">레벨</label>
                  <select value={policyForm.level} onChange={e => setPolicyForm({ ...policyForm, level: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">서비스</label>
                  <select value={policyForm.service} onChange={e => setPolicyForm({ ...policyForm, service: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">월 한도 (토큰)</label>
                  <input type="number" value={policyForm.monthlyLimit} onChange={e => setPolicyForm({ ...policyForm, monthlyLimit: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예) 500000" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">경고 임계값 (%)</label>
                <input type="number" value={policyForm.warningThreshold} onChange={e => setPolicyForm({ ...policyForm, warningThreshold: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={submitPolicy} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium">저장</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="font-semibold">{data.yearMonth} 사용량 현황</h2>
            <div className="flex gap-4 text-sm">
              {Object.entries(data.totalByService || {}).map(([s, t]: any) => (
                <span key={s} className="text-gray-600"><span className="font-medium capitalize">{s}</span>: {t.toLocaleString()}</span>
              ))}
            </div>
          </div>
          {data.usageRecords?.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">이번 달 입력된 사용량이 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="text-left px-4 py-3">직원</th>
                    <th className="text-left px-4 py-3">부서</th>
                    <th className="text-left px-4 py-3">레벨</th>
                    <th className="text-left px-4 py-3">서비스</th>
                    <th className="text-right px-4 py-3">토큰</th>
                    <th className="text-right px-4 py-3">비용(₩)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.usageRecords.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.employee?.name}</td>
                      <td className="px-4 py-3 text-gray-500">{r.employee?.department}</td>
                      <td className="px-4 py-3 text-blue-600 font-medium">{r.employee?.currentLevel}</td>
                      <td className="px-4 py-3 capitalize">{r.service}</td>
                      <td className="px-4 py-3 text-right">{r.tokenUsed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{r.costKrw > 0 ? `₩${r.costKrw.toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
