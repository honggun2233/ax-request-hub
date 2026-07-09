import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function MePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">안녕하세요, {session.user.name}님</h1>
        <p className="text-gray-500 mb-6">
          {(session.user as any).department} · AI 레벨 {(session.user as any).currentLevel}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <a
            href="/me/level"
            className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition"
          >
            <div className="text-2xl mb-2">🎯</div>
            <h2 className="font-semibold">AI 레벨</h2>
            <p className="text-sm text-gray-500 mt-1">레벨 신청 및 현황</p>
          </a>
          <a
            href="/me/services"
            className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition"
          >
            <div className="text-2xl mb-2">🔧</div>
            <h2 className="font-semibold">배분 서비스</h2>
            <p className="text-sm text-gray-500 mt-1">내 AI 서비스 목록</p>
          </a>
          <a
            href="/me/usage"
            className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition"
          >
            <div className="text-2xl mb-2">📊</div>
            <h2 className="font-semibold">사용량</h2>
            <p className="text-sm text-gray-500 mt-1">토큰 한도 및 사용 현황</p>
          </a>
        </div>
      </div>
    </div>
  )
}
