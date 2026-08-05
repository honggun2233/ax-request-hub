"use client"
import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

const STATUS_LABELS: Record<string, string> = { PENDING: "대기", REVIEWING: "심사중", APPROVED: "승인", REJECTED: "반려" }
const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  REVIEWING: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
}
const COLUMNS = ["PENDING", "REVIEWING", "APPROVED", "REJECTED"]

export default function AdminEmployeesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>({ applications: [], employees: [] })
  const [selected, setSelected] = useState<any>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [grantLevel, setGrantLevel] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => fetch("/api/admin/employees").then(r => r.json()).then(setData)
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") load()
  }, [status])

  const handleReview = async (appStatus: "APPROVED" | "REJECTED") => {
    await fetch(`/api/admin/level/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: appStatus, reviewNote, grantLevel: grantLevel || selected.requestedLevel }),
    })
    setSelected(null); setReviewNote(""); setGrantLevel(""); load()
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setUploadMsg("")
    const fd = new FormData(); fd.append("file", file)
    const res = await fetch("/api/admin/employees", { method: "POST", body: fd })
    const result = await res.json()
    setUploading(false)
    setUploadMsg(`생성 ${result.created}건, 업데이트 ${result.updated}건${result.errors?.length ? ` / 오류 ${result.errors.length}건` : ""}`)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <a href="/admin" className="text-sm text-gray-500 hover:underline">← 관리 포털</a>
            <h1 className="text-2xl font-bold mt-1">직원 · 교육 관리</h1>
          </div>
          <div className="flex gap-2">
            <a href="/api/admin/employees/export" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">엑셀 다운로드</a>
            <button onClick={() => fileRef.current?.click()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700" disabled={uploading}>
              {uploading ? "업로드 중..." : "엑셀 업로드"}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <a href="/admin/employees" className="px-4 py-2 text-sm font-medium border-b-2 border-blue-500 text-blue-600 -mb-px">레벨 심사</a>
          <a href="/admin/literacy" className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 -mb-px">교육 관리</a>
        </div>

        {uploadMsg && <div className="bg-blue-50 text-blue-800 rounded-lg p-3 mb-4 text-sm">{uploadMsg}</div>}

        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <div key={col} className="bg-gray-100 rounded-xl p-3">
              <h3 className="font-semibold text-sm mb-3 flex justify-between">
                {STATUS_LABELS[col]}
                <span className="bg-white rounded-full px-2 text-xs font-normal">
                  {data.applications.filter((a: any) => a.status === col).length}
                </span>
              </h3>
              <div className="space-y-2">
                {data.applications.filter((a: any) => a.status === col).map((app: any) => (
                  <div key={app.id} className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md" onClick={() => { setSelected(app); setGrantLevel(app.requestedLevel) }}>
                    <p className="font-medium text-sm">{app.employee?.name}</p>
                    <p className="text-xs text-gray-500">{app.employee?.department}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-bold text-blue-600">{app.requestedLevel} 신청</span>
                      <span className="text-xs text-gray-400">{new Date(app.createdAt).toLocaleDateString("ko-KR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">{selected.employee?.name} — {selected.requestedLevel} 신청 심사</h2>
              <div className="space-y-3 mb-4 text-sm">
                <div><span className="font-medium">부서:</span> {selected.employee?.department}</div>
                <div><span className="font-medium">현재 레벨:</span> {selected.currentLevel}</div>
                <div><span className="font-medium">자기소개:</span><p className="bg-gray-50 rounded p-2 mt-1">{selected.selfIntro || "—"}</p></div>
                <div><span className="font-medium">교육 이수:</span><p className="bg-gray-50 rounded p-2 mt-1">{selected.trainingCompleted || "—"}</p></div>
                <div><span className="font-medium">활용 계획:</span><p className="bg-gray-50 rounded p-2 mt-1">{selected.utilizationPlan || "—"}</p></div>
              </div>
              {selected.status === "PENDING" || selected.status === "REVIEWING" ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">부여 레벨</label>
                    <select value={grantLevel} onChange={e => setGrantLevel(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                      {["L1", "L2", "L3", "L4"].map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">심사 코멘트</label>
                    <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="승인/반려 사유" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleReview("APPROVED")} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium">승인</button>
                    <button onClick={() => handleReview("REJECTED")} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium">반려</button>
                    <button onClick={() => setSelected(null)} className="flex-1 border py-2 rounded-lg text-sm">닫기</button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                  {selected.reviewNote && <p className="text-sm text-gray-600 mt-2">{selected.reviewNote}</p>}
                  <button onClick={() => setSelected(null)} className="mt-3 w-full border py-2 rounded-lg text-sm">닫기</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
