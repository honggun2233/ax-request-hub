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
  PENDING:   { text: '처리 중', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED:  { text: '승인됨',  color: 'bg-blue-100 text-blue-800' },
  ACTIVE:    { text: '사용 중', color: 'bg-green-100 text-green-800' },
  SUSPENDED: { text: '정지',    color: 'bg-red-100 text-red-800' },
  RETURNED:  { text: '반납됨',  color: 'bg-gray-100 text-gray-600' },
}

export default async function MyToolsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')

  const employee = await db.employee.findUnique({
    where: { email: session.user.email },
    include: {
      toolAccounts: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!employee) redirect('/me')

  const active = employee.toolAccounts.filter(a => a.status !== 'RETURNED')
  const returned = employee.toolAccounts.filter(a => a.status === 'RETURNED')

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">내 AI 도구 현황</h1>
        <p className="text-sm text-gray-500 mb-8">
          AI 도구 계정 신청은 부서장을 통해 진행됩니다.
        </p>

        {active.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
            현재 배정된 AI 도구 계정이 없습니다.<br />
            <span className="text-sm">부서장에게 배정 요청하세요.</span>
          </div>
        )}

        <div className="space-y-4">
          {active.map(account => {
            const s = STATUS_LABEL[account.status] ?? { text: account.status, color: 'bg-gray-100 text-gray-600' }
            return (
              <div key={account.id} className="bg-white rounded-xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <div className="font-semibold">{TOOL_LABEL[account.toolType] ?? account.toolType}</div>
                  <div className="text-sm text-gray-500 mt-1">{account.requestReason}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    배정일: {new Date(account.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>{s.text}</span>
                  {['PENDING', 'ACTIVE'].includes(account.status) && (
                    <form action={`/api/tools/request`} method="POST">
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch('/api/tools/request', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: account.id }),
                          })
                          window.location.reload()
                        }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        반납
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {returned.length > 0 && (
          <details className="mt-8">
            <summary className="text-sm text-gray-400 cursor-pointer">반납 이력 ({returned.length}건)</summary>
            <div className="mt-2 space-y-2">
              {returned.map(account => (
                <div key={account.id} className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 flex justify-between">
                  <span>{TOOL_LABEL[account.toolType] ?? account.toolType}</span>
                  <span>{account.returnedAt ? new Date(account.returnedAt).toLocaleDateString('ko-KR') : '-'}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
