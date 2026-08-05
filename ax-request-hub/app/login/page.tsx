"use client"
import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"

const QUICK_ACCOUNTS = [
  { label: "AX팀 관리자",    email: "admin@samsungam.com", badge: "AX_TEAM",       level: "L4" },
  { label: "부서장",          email: "dept@samsungam.com",  badge: "DEPT_HEAD",     level: "L3" },
  { label: "경영진",          email: "exec@samsungam.com",  badge: "EXECUTIVE",     level: "L4" },
  { label: "데이터플랫폼팀",  email: "dp@samsungam.com",    badge: "DATA_PLATFORM", level: "L3" },
  { label: "일반 직원",       email: "test@samsungam.com",  badge: "EMPLOYEE",      level: "L2" },
]

const BADGE_COLOR: Record<string, string> = {
  AX_TEAM:       "bg-[#C8A84B]/10 text-[#C8A84B] border border-[#C8A84B]/30",
  DEPT_HEAD:     "bg-blue-500/10 text-blue-300 border border-blue-400/30",
  EXECUTIVE:     "bg-purple-500/10 text-purple-300 border border-purple-400/30",
  DATA_PLATFORM: "bg-teal-500/10 text-teal-300 border border-teal-400/30",
  EMPLOYEE:      "bg-white/10 text-white/60 border border-white/20",
}

const GATE_STATS = [
  { label: "등록 에이전트",  value: "19", unit: "개" },
  { label: "Gate 3 통과",    value: "3",  unit: "개" },
  { label: "AI 활용",        value: "24", unit: "건" },
  { label: "리터러시 레벨",  value: "L0–L4", unit: "" },
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
    <div className="min-h-screen flex">
      {/* ── Left panel: navy branding ── */}
      <div className="hidden lg:flex w-[55%] flex-col justify-between bg-[#0B1F3A] px-14 py-12 relative overflow-hidden">
        {/* Background geometric accent */}
        <div className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full bg-[#1E3A5F] opacity-40 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[320px] h-[320px] rounded-full bg-[#0D2848] opacity-60 -translate-x-1/3 translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-[120px] right-[80px] w-[180px] h-[180px] rounded-full bg-[#C8A84B]/5 pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#C8A84B] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" />
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">삼성자산운용</p>
              <p className="text-[#C8A84B] text-xs font-medium tracking-wide">AX Request Hub</p>
            </div>
          </div>
        </div>

        {/* Main headline */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              AI 거버넌스를<br />
              <span className="text-[#C8A84B]">하나의 플랫폼</span>으로
            </h1>
            <p className="text-white/50 mt-4 text-sm leading-relaxed max-w-sm">
              AI 활용 신청부터 에이전트 배포, 위원회 심의까지.<br />
              삼성자산운용의 AI 도입 전 과정을 추적하고 통제합니다.
            </p>
          </div>

          {/* Gate pipeline mini-diagram */}
          <div className="flex items-center gap-1 text-xs">
            {["신청", "평가", "Gate 1", "Gate 2", "Gate 3", "위원회", "운영"].map((step, i) => (
              <span key={step} className="flex items-center gap-1">
                <span className={`px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap
                  ${i < 3 ? 'bg-[#C8A84B]/20 text-[#C8A84B]' : 'bg-white/10 text-white/40'}`}>
                  {step}
                </span>
                {i < 6 && <span className="text-white/20">→</span>}
              </span>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {GATE_STATS.map(s => (
              <div key={s.label} className="bg-white/5 rounded-lg p-3 border border-white/10">
                <p className="text-xl font-bold text-white">{s.value}<span className="text-xs text-white/40 ml-0.5">{s.unit}</span></p>
                <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/25 text-xs">
            삼성자산운용 AX/PI센터 · IT업무개발팀 · 내부 전용 시스템
          </p>
        </div>
      </div>

      {/* ── Right panel: login form ── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-[#F7F6F3] px-8">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <p className="text-[#0B1F3A] font-bold text-lg">삼성자산운용 AX Hub</p>
        </div>

        <div className="w-full max-w-[360px] space-y-6">
          <div>
            <h2 className="text-[#0B1F3A] text-2xl font-bold">시작하기</h2>
            <p className="text-[#94A3B8] text-sm mt-1">역할을 선택하거나 사내 계정으로 로그인하세요.</p>
          </div>

          {/* Quick login accounts */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest">역할 선택</p>
            <div className="space-y-1.5">
              {QUICK_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  onClick={() => doLogin(a.email, a.email)}
                  disabled={loading !== null}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white hover:bg-[#0B1F3A] hover:text-white border border-[#E2E8F0] hover:border-[#0B1F3A] text-sm transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-[#334155] group-hover:text-white transition-colors">{a.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${BADGE_COLOR[a.badge]} group-hover:bg-white/15 group-hover:text-white/80 group-hover:border-white/20 transition-all`}>
                      {a.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#94A3B8] group-hover:text-white/50 transition-colors">{a.level}</span>
                    {loading === a.email ? (
                      <span className="w-3.5 h-3.5 border-2 border-[#C8A84B] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5 text-[#CBD5E1] group-hover:text-white/40 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-widest">또는</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          {/* Manual email login */}
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@samsungam.com"
              className="w-full border border-[#E2E8F0] bg-white rounded-xl px-4 py-3 text-sm text-[#334155] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]/20 focus:border-[#0B1F3A] transition-all"
            />
            {error && (
              <p className="text-red-500 text-xs flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading !== null || !email}
              className="w-full bg-[#0B1F3A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#1E3A5F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading === "manual" ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  로그인 중...
                </span>
              ) : "로그인"}
            </button>
          </form>

          <p className="text-center text-[10px] text-[#CBD5E1]">사내 SSO 연동 준비 중 · 프로토타입 v1</p>
        </div>
      </div>
    </div>
  )
}
