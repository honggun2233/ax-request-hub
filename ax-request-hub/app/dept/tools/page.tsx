import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/src/lib/db'

const TOOL_LABEL: Record<string, string> = {
  GPT_CHAT: 'ChatGPT (Chat)',
  GPT_EXCEL: 'ChatGPT (Excel)',
  GEMINI: 'Gemini Enterprise',
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING:   { text: '처리 중', color: 'text-yellow-600 bg-yellow-50' },
  APPROVED:  { text: '승인됨',  color: 'text-blue-600 bg-blue-50' },
  ACTIVE:    { text: '사용 중', color: 'text-green-600 bg-green-50' },
  SUSPENDED: { text: '정지',    color: 'text-red-600 bg-red-50' },
  RETURNED:  { text: '반납됨',  color: 'text-gray-500 bg-gray-50' },
}

const ADMIN_ROLES = ['AX_TEAM', 'EXECUTIVE', 'C_LEVEL']

export default async function DeptToolsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')

  const email = session.user.email
  const role = (session.user as any)?.role ?? 'EMPLOYEE'

  // AX_TEAM·EXECUTIVE는 전체 쿼타, 부서장은 자신이 관리하는 것만
  const isAdmin = ADMIN_ROLES.includes(role)

  const quotas = await db.departmentQuota.findMany({
    where: isAdmin ? {} : { managedBy: email },
    include: {
      toolAccounts: {
        include: { employee: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { toolType: 'asc' },
  })

  if (quotas.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-lg font-medium mb-2">쿼타 없음</div>
          <div className="text-sm">등록된 AI 도구 쿼타가 없습니다. AX팀에 문의하세요.</div>
        </div>
      </div>
    )
  }

  const department = quotas[0].department

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">AI 도구 배정 관리</h1>
        <p className="text-sm text-gray-500 mb-8">{department} · 부서장 관리 메뉴</p>

        {/* 쿼터 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {quotas.map(q => {
            const activeCount = q.toolAccounts.filter(a => ['PENDING','APPROVED','ACTIVE'].includes(a.status)).length
            const remaining = q.totalQuota - activeCount
            return (
              <div key={q.id} className="bg-white rounded-xl p-5 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">{TOOL_LABEL[q.toolType] ?? q.toolType}</div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold">{remaining}</span>
                  <span className="text-gray-400 text-sm mb-1">/ {q.totalQuota} 잔여</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">사용 중: {activeCount}석</div>
              </div>
            )
          })}
        </div>

        {/* 팀원 계정 목록 */}
        {quotas.map(q => {
          const members = q.toolAccounts.filter(a => a.status !== 'RETURNED')
          return (
            <div key={q.id} className="mb-8">
              <h2 className="text-base font-semibold mb-3">{TOOL_LABEL[q.toolType] ?? q.toolType} 배정 현황</h2>
              {members.length === 0 ? (
                <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm shadow-sm">
                  배정된 팀원이 없습니다.
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-600">이름</th>
                        <th className="text-left p-4 font-medium text-gray-600">이메일</th>
                        <th className="text-left p-4 font-medium text-gray-600">상태</th>
                        <th className="text-left p-4 font-medium text-gray-600">배정일</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {members.map(acc => {
                        const s = STATUS_LABEL[acc.status] ?? { text: acc.status, color: '' }
                        return (
                          <tr key={acc.id}>
                            <td className="p-4 font-medium">{acc.employee.name}</td>
                            <td className="p-4 text-gray-500">{acc.employee.email}</td>
                            <td className="p-4">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>{s.text}</span>
                            </td>
                            <td className="p-4 text-gray-400">{new Date(acc.createdAt).toLocaleDateString('ko-KR')}</td>
                            <td className="p-4">
                              <button
                                onClick={async () => {
                                  if (!confirm(`${acc.employee.name} 계정을 회수하시겠습니까?`)) return
                                  await fetch('/api/dept/tools/revoke', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ accountId: acc.id }),
                                  })
                                  window.location.reload()
                                }}
                                className="text-xs text-red-500 hover:underline"
                              >
                                회수
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}

        {/* 배정 신청 폼 */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-4">신규 배정 신청</h2>
          <DeptAssignForm quotas={quotas.map(q => ({
            id: q.id,
            toolType: q.toolType,
            remaining: q.totalQuota - q.toolAccounts.filter(a => ['PENDING','APPROVED','ACTIVE'].includes(a.status)).length,
          }))} />
        </div>
      </div>
    </div>
  )
}

function DeptAssignForm({ quotas }: { quotas: { id: string; toolType: string; remaining: number }[] }) {
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const res = await fetch('/api/dept/tools/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeEmail: fd.get('employeeEmail'),
            toolType: fd.get('toolType'),
            requestReason: fd.get('requestReason'),
          }),
        })
        if (res.ok) {
          alert('배정 신청이 완료됐습니다. AX팀이 SDS를 통해 계정을 발급합니다.')
          window.location.reload()
        } else {
          const data = await res.json()
          alert(data.error ?? '오류가 발생했습니다.')
        }
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">팀원 이메일</label>
        <input
          name="employeeEmail"
          type="email"
          required
          placeholder="hong@samsung.com"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">도구 선택</label>
        <select
          name="toolType"
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">선택하세요</option>
          {quotas.map(q => (
            <option key={q.toolType} value={q.toolType} disabled={q.remaining <= 0}>
              {TOOL_LABEL[q.toolType] ?? q.toolType} (잔여 {q.remaining}석)
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">배정 사유 (20자 이상)</label>
        <textarea
          name="requestReason"
          required
          minLength={20}
          rows={3}
          placeholder="업무 활용 계획을 구체적으로 입력하세요"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition"
      >
        배정 신청
      </button>
    </form>
  )
}
