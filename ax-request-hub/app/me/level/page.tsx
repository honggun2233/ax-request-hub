"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const LEVELS = ["L1", "L2", "L3", "L4"]
const LEVEL_DESC: Record<string, string> = {
  L1: "Gemini, GPT for Excel",
  L2: "GPT Enterprise, Claude.ai",
  L3: "Codex, Claude Code, Antigravity",
  L4: "AI 격리환경, AWS Bedrock",
}

export default function MyLevelPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [applying, setApplying] = useState(false)
  const [form, setForm] = useState({ requestedLevel: "L1", selfIntro: "", trainingCompleted: "", utilizationPlan: "", recommendationNote: "" })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    fetch("/api/level").then(r => r.json()).then(setData)
  }, [status])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/level", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    const result = await res.json()
    setLoading(false)
    if (res.ok) {
      setMsg("신청 완료! AX팀 심사 후 이메일로 안내됩니다.")
      setApplying(false)
      fetch("/api/level").then(r => r.json()).then(setData)
    } else {
      setMsg(result.error || "신청 실패")
    }
  }

  const currentLevel = (session?.user as any)?.currentLevel || data?.currentLevel || "L0"
  const statusColor: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    REVIEWING: "bg-blue-100 text-blue-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <a href="/me" className="text-sm text-gray-500 hover:underline">← 내 현황</a>
        </div>
        <h1 className="text-2xl font-bold mb-2">AI 레벨 관리</h1>
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <p className="text-sm text-gray-500 mb-1">현재 레벨</p>
          <p className="text-4xl font-bold text-blue-600">{currentLevel}</p>
          {currentLevel !== "L0" && <p className="text-sm text-gray-500 mt-1">{LEVEL_DESC[currentLevel]}</p>}
        </div>

        {msg && <div className="bg-blue-50 text-blue-800 rounded-lg p-3 mb-4 text-sm">{msg}</div>}

        {!applying ? (
          <button onClick={() => setApplying(true)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 mb-6">
            레벨 신청하기
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm mb-6 space-y-4">
            <h2 className="font-semibold text-lg">레벨 신청</h2>
            <div>
              <label className="block text-sm font-medium mb-1">신청 레벨</label>
              <select value={form.requestedLevel} onChange={e => setForm({ ...form, requestedLevel: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                {LEVELS.map(l => <option key={l} value={l}>{l} — {LEVEL_DESC[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">자기소개 및 AI 활용 현황</label>
              <textarea value={form.selfIntro} onChange={e => setForm({ ...form, selfIntro: e.target.value })} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="현재 업무에서 AI를 어떻게 활용하고 있는지 기술해주세요" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">교육 이수 현황</label>
              <input type="text" value={form.trainingCompleted} onChange={e => setForm({ ...form, trainingCompleted: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="예) AI 기초 과정 이수 (2026.05), CREW Lv.1 취득" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">활용 계획</label>
              <textarea value={form.utilizationPlan} onChange={e => setForm({ ...form, utilizationPlan: e.target.value })} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="해당 레벨 AI 서비스를 어떤 업무에 활용할 계획인지 기술해주세요" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">부서장 추천 메모</label>
              <input type="text" value={form.recommendationNote} onChange={e => setForm({ ...form, recommendationNote: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="부서장 추천 여부 및 사유" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{loading ? "제출 중..." : "신청 제출"}</button>
              <button type="button" onClick={() => setApplying(false)} className="flex-1 border py-2 rounded-lg text-sm">취소</button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h2 className="font-semibold p-4 border-b">신청 이력</h2>
          {!data?.applications?.length ? (
            <p className="text-gray-500 text-sm p-4">신청 이력이 없습니다.</p>
          ) : (
            <div className="divide-y">
              {data.applications.map((app: any) => (
                <div key={app.id} className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{app.requestedLevel} 신청</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[app.status]}`}>{app.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{new Date(app.createdAt).toLocaleDateString("ko-KR")}</p>
                  {app.reviewNote && <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded p-2">{app.reviewNote}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
