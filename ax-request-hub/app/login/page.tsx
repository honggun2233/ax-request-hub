"use client"
import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"

const QUICK_ACCOUNTS = [
  { label: "AX팀 관리자 (L4)", email: "admin@samsungam.com", badge: "AX_TEAM" },
  { label: "부서장 (L3)",       email: "dept@samsungam.com",  badge: "DEPT_HEAD" },
  { label: "경영진 (L4)",       email: "exec@samsungam.com",  badge: "EXECUTIVE" },
  { label: "데이터플랫폼 (L3)", email: "dp@samsungam.com",    badge: "DATA_PLATFORM" },
  { label: "일반 직원 (L2)",    email: "test@samsungam.com",  badge: "EMPLOYEE" },
]

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState("")
  const router = useRouter()

  const doLogin = async (targetEmail: string, key: string) => {
    setLoading(key)
    setError("")
    const res = await signIn("credentials", { email: targetEmail, password: "internal", redirect: false })
    setLoading(null)
    if (res?.ok) router.push("/me")
    else setError("등록된 계정이 없습니다. AX팀에 문의하세요.")
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    doLogin(email, "manual")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">AI Hub</h1>
          <p className="text-gray-500 text-sm mt-1">삼성자산운용 AI 거버넌스 플랫폼</p>
        </div>

        {/* 빠른 로그인 (개발·테스트용) */}
        <div className="rounded-lg border border-dashed border-gray-300 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-400 text-center">빠른 로그인 (개발·테스트)</p>
          {QUICK_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              onClick={() => doLogin(a.email, a.email)}
              disabled={loading !== null}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 text-sm transition-colors disabled:opacity-50"
            >
              <span className="font-medium text-gray-700">{a.label}</span>
              <span className="text-xs text-gray-400 font-mono">{a.badge}</span>
              {loading === a.email && <span className="text-xs text-blue-500 ml-1">…</span>}
            </button>
          ))}
        </div>

        {/* 직접 입력 */}
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">또는 직접 입력</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@samsungam.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading !== null || !email}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === "manual" ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">사내 SSO 연동 준비 중 | Phase 1 임시 로그인</p>
      </div>
    </div>
  )
}
