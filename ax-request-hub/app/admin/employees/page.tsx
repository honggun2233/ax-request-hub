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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <a href="/admin" className="text-sm text-[var(--muted)] hover:underline">← 관리 포털</a>
          <h1 className="text-2xl font-bold mt-1">직원 · 교육 관리</h1>
        </div>
        <div className="flex gap-2">
          <a href="/api/admin/employees/export" className="bg-[#4A6FA5] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1E3560]">엑셀 다운로드</a>
          <button onClick={() => fileRef.current?.click()} className="bg-[#4A6FA5] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1E3560]" disabled={uploading}>
            {uploading ? "업로드 중..." : "엑셀 업로드"}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-[#E4E9F2]">
        <a href="/admin/employees" className="px-4 py-2 text-sm font-medium border-b-2 border-[#4A6FA5] text-[#4A6FA5] -mb-px">레벨 심사</a>
        <a href="/admin/literacy" className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-[var(--muted)] hover:text-[#18243D] -mb-px">교육 관리</a>
      </div>

      {uploadMsg && <div className="bg-blue-50 text-blue-800 rounded-lg p-3 text-sm">{uploadMsg}</div>}

      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map(col => (
          <div key={col} className="bg-[#EBF1F9] rounded-xl p-3">
            <h3 className="font-semibold text-sm mb-3 flex justify-between text-[#18243D]">
              {STATUS_LABELS[col]}
              <span className="bg-white rounded-full px-2 text-xs font-normal text-[var(--muted)]">
                {data.applications.filter((a: any) => a.status === col).length}
              </span>
            </h3>
            <div className="space-y-2">
              {data.applications.filter((a: any) => a.status === col).map((app: any) => (
                <div key={app.id} className="bg-white rounded-lg p-3 border border-[#E4E9F2] cursor-pointer hover:border-[#B8956A] hover:shadow-sm transition-all" onClick={() => { setSelected(app); setGrantLevel(app.requestedLevel) }}>
                  <p className="font-medium text-sm text-[#18243D]">{app.employee?.name}</p>
                  <p className="text-xs text-[var(--muted)]">{app.employee?.department}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs font-bold text-[#4A6FA5]">{app.requestedLevel} 신청</span>
                    <span className="text-xs text-[var(--muted)]">{new Date(app.createdAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl border border-[#E4E9F2]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 text-[#18243D]">{selected.employee?.name} — {selected.requestedLevel} 신청 심사</h2>
            <div className="space-y-3 mb-4 text-sm text-[#18243D]">
              <div><span className="font-medium">부서:</span> {selected.employee?.department}</div>
              <div><span className="font-medium">현재 레벨:</span> {selected.currentLevel}</div>
              <div><span className="font-medium">자기소개:</span><p className="bg-[#F7F9FC] border border-[#E4E9F2] rounded p-2 mt-1 text-[var(--muted)]">{selected.selfIntro || "—"}</p></div>
              <div><span className="font-medium">교육 이수:</span><p className="bg-[#F7F9FC] border border-[#E4E9F2] rounded p-2 mt-1 text-[var(--muted)]">{selected.trainingCompleted || "—"}</p></div>
              <div><span className="font-medium">활용 계획:</span><p className="bg-[#F7F9FC] border border-[#E4E9F2] rounded p-2 mt-1 text-[var(--muted)]">{selected.utilizationPlan || "—"}</p></div>
            </div>
            {selected.status === "PENDING" || selected.status === "REVIEWING" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#18243D]">부여 레벨</label>
                  <select value={grantLevel} onChange={e => setGrantLevel(e.target.value)} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]">
                    {["L1", "L2", "L3", "L4"].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[#18243D]">심사 코멘트</label>
                  <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2} className="w-full border border-[#E4E9F2] rounded-lg px-3 py-2 text-sm bg-white text-[#18243D]" placeholder="승인/반려 사유" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleReview("APPROVED")} className="flex-1 bg-[#4A6FA5] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1E3560]">승인</button>
                  <button onClick={() => handleReview("REJECTED")} className="flex-1 bg-[#B94040] text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">반려</button>
                  <button onClick={() => setSelected(null)} className="flex-1 border border-[#E4E9F2] py-2 rounded-lg text-sm text-[var(--muted)] hover:bg-[#F7F9FC]">닫기</button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLOR[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                {selected.reviewNote && <p className="text-sm text-[var(--muted)] mt-2">{selected.reviewNote}</p>}
                <button onClick={() => setSelected(null)} className="mt-3 w-full border border-[#E4E9F2] py-2 rounded-lg text-sm text-[var(--muted)] hover:bg-[#F7F9FC]">닫기</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
