import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/src/lib/db"

export default async function MePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const userId = (session.user as any).id
  const yearMonth = new Date().toISOString().slice(0, 7)

  const [employee, pendingApp, activeAllocations, monthUsage] = await Promise.all([
    db.employee.findUnique({ where: { id: userId } }),
    db.levelApplication.findFirst({ where: { employeeId: userId, status: { in: ["PENDING", "REVIEWING"] } }, orderBy: { createdAt: "desc" } }),
    db.serviceAllocation.count({ where: { employeeId: userId, status: "ACTIVE" } }),
    db.usageRecord.findMany({ where: { employeeId: userId, yearMonth } }),
  ])

  const totalUsed = monthUsage.reduce((s, r) => s + r.tokenUsed, 0)
  const currentLevel = employee?.currentLevel || "L0"

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold">안녕하세요, {session.user.name}님</h1>
            <p className="text-gray-500 mt-1">{(session.user as any).department}</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-blue-600">{currentLevel}</span>
            <p className="text-xs text-gray-400">AI 레벨</p>
          </div>
        </div>

        {pendingApp && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-sm text-yellow-800">
            📋 {pendingApp.requestedLevel} 레벨 신청이 심사 중입니다.
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <a href="/me/level" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
            <div className="text-2xl mb-3">🎯</div>
            <h2 className="font-semibold">AI 레벨</h2>
            <p className="text-2xl font-bold text-blue-600 mt-1">{currentLevel}</p>
            <p className="text-xs text-gray-400 mt-1">{pendingApp ? "심사 중" : "레벨 신청"} →</p>
          </a>
          <a href="/me/services" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
            <div className="text-2xl mb-3">🔧</div>
            <h2 className="font-semibold">배분 서비스</h2>
            <p className="text-2xl font-bold text-green-600 mt-1">{activeAllocations}개</p>
            <p className="text-xs text-gray-400 mt-1">활성 서비스 →</p>
          </a>
          <a href="/me/usage" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
            <div className="text-2xl mb-3">📊</div>
            <h2 className="font-semibold">이번 달 사용량</h2>
            <p className="text-2xl font-bold text-purple-600 mt-1">{totalUsed > 0 ? `${(totalUsed / 1000).toFixed(0)}K` : "0"}</p>
            <p className="text-xs text-gray-400 mt-1">토큰 →</p>
          </a>
        </div>
      </div>
    </div>
  )
}
