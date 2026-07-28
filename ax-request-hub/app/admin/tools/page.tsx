import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/src/lib/db'

const TOOL_LABEL: Record<string, string> = {
  GPT_CHAT: 'ChatGPT Chat',
  GPT_EXCEL: 'ChatGPT Excel',
  GEMINI: 'Gemini Enterprise',
}

const TOOL_LIMIT: Record<string, number> = {
  GPT_CHAT: 100,
  GPT_EXCEL: 50,
  GEMINI: 50,
}

export default async function AdminToolsPage() {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any).role)) redirect('/me')

  const quotas = await db.departmentQuota.findMany({
    include: {
      toolAccounts: { where: { status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } }, select: { id: true } },
    },
    orderBy: [{ toolType: 'asc' }, { department: 'asc' }],
  })

  const pending = await db.toolAccount.findMany({
    where: { status: 'PENDING' },
    include: {
      employee: { select: { name: true, email: true, department: true } },
      quota: { select: { department: true, toolType: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // 전체 사용량 집계
  const totalByTool = await db.toolAccount.groupBy({
    by: ['toolType'],
    where: { status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } },
    _count: { id: true },
  })
  const usageMap = Object.fromEntries(totalByTool.map(t => [t.toolType, t._count.id]))

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">AI 도구 계정 관리</h1>
        <p className="text-sm text-gray-500 mb-8">전사 AI 도구 계정 현황 · 부서별 쿼터 관리</p>

        {/* 전사 게이지 */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {['GPT_CHAT', 'GPT_EXCEL', 'GEMINI'].map(toolType => {
            const used = usageMap[toolType] ?? 0
            const limit = TOOL_LIMIT[toolType]
            const pct = Math.min(100, Math.round((used / limit) * 100))
            return (
              <div key={toolType} className="bg-white rounded-xl p-5 shadow-sm">
                <div className="text-sm font-medium mb-3">{TOOL_LABEL[toolType]}</div>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold">{used}</span>
                  <span className="text-gray-400 text-sm mb-1">/ {limit}석</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">{pct}% 사용</div>
              </div>
            )
          })}
        </div>

        {/* PENDING 처리 */}
        {pending.length > 0 && (
          <div className="mb-10">
            <h2 className="text-base font-semibold mb-3">⏳ SDS 발급 요청 대기 ({pending.length}건)</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-600">직원</th>
                    <th className="text-left p-4 font-medium text-gray-600">부서</th>
                    <th className="text-left p-4 font-medium text-gray-600">도구</th>
                    <th className="text-left p-4 font-medium text-gray-600">신청일</th>
                    <th className="p-4 font-medium text-gray-600">처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pending.map(acc => (
                    <tr key={acc.id}>
                      <td className="p-4">
                        <div className="font-medium">{acc.employee.name}</div>
                        <div className="text-xs text-gray-400">{acc.employee.email}</div>
                      </td>
                      <td className="p-4 text-gray-500">{acc.quota?.department ?? acc.employee.department}</td>
                      <td className="p-4">{TOOL_LABEL[acc.toolType] ?? acc.toolType}</td>
                      <td className="p-4 text-gray-400">{new Date(acc.createdAt).toLocaleDateString('ko-KR')}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              await fetch(`/api/admin/tools/${acc.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'APPROVED' }),
                              })
                              window.location.reload()
                            }}
                            className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                          >
                            SDS 요청완료 → 승인
                          </button>
                          <button
                            onClick={async () => {
                              await fetch(`/api/admin/tools/${acc.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'RETURNED' }),
                              })
                              window.location.reload()
                            }}
                            className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300"
                          >
                            반려
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 부서별 쿼터 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">부서별 쿼터 현황</h2>
            <a href="/admin/tools/quota-setup" className="text-xs text-blue-600 hover:underline">쿼터 설정 →</a>
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-600">부서</th>
                  <th className="text-left p-4 font-medium text-gray-600">도구</th>
                  <th className="text-left p-4 font-medium text-gray-600">쿼터</th>
                  <th className="text-left p-4 font-medium text-gray-600">사용 중</th>
                  <th className="text-left p-4 font-medium text-gray-600">잔여</th>
                  <th className="text-left p-4 font-medium text-gray-600">부서장</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quotas.map(q => {
                  const used = q.toolAccounts.length
                  const remaining = q.totalQuota - used
                  return (
                    <tr key={q.id}>
                      <td className="p-4 font-medium">{q.department}</td>
                      <td className="p-4 text-gray-600">{TOOL_LABEL[q.toolType] ?? q.toolType}</td>
                      <td className="p-4">{q.totalQuota}석</td>
                      <td className="p-4">{used}석</td>
                      <td className="p-4">
                        <span className={remaining <= 0 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                          {remaining}석
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 text-xs">{q.managedBy || '미지정'}</td>
                    </tr>
                  )
                })}
                {quotas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      부서 쿼터가 설정되지 않았습니다.{' '}
                      <a href="/admin/tools/quota-setup" className="text-blue-500 hover:underline">쿼터 설정하기</a>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
