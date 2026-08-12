import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ReturnButton } from './ReturnButton'
import { ToolRequestForm } from './ToolRequestForm'

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

  const employee = await prisma.employee.findUnique({
    where: { email: session.user.email },
    include: {
      toolAccounts: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!employee) redirect('/me')

  const active  = employee.toolAccounts.filter(a => a.status !== 'RETURNED')
  const returned = employee.toolAccounts.filter(a => a.status === 'RETURNED')

  // 이미 신청 중·활성 상태인 도구 타입 목록 (중복 신청 방지용)
  const activeTypes = active
    .filter(a => ['PENDING', 'APPROVED', 'ACTIVE'].includes(a.status))
    .map(a => a.toolType)

  return (
    <div className="max-w-3xl mx-auto space-y-8">

        {/* 현재 사용 중인 도구 */}
        <section>
          <h1 className="text-2xl font-bold mb-1">내 AI 도구 현황</h1>
          <p className="text-sm text-[var(--muted)] mb-6">
            신청 → AX팀 검토 → 부서장 최종 배정 순으로 진행됩니다.
          </p>

          {active.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center text-[var(--muted)] shadow-sm border border-[#E4E9F2]">
              아직 배정된 AI 도구가 없습니다.
              <br />
              <span className="text-sm">아래에서 바로 신청하세요.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map(account => {
                const s = STATUS_LABEL[account.status] ?? { text: account.status, color: 'bg-gray-100 text-gray-600' }
                return (
                  <div key={account.id} className="bg-white rounded-xl p-5 shadow-sm flex items-center justify-between border border-[#E4E9F2]">
                    <div>
                      <div className="font-semibold">{TOOL_LABEL[account.toolType] ?? account.toolType}</div>
                      {account.requestReason && (
                        <div className="text-sm text-[var(--muted)] mt-1 line-clamp-1">{account.requestReason}</div>
                      )}
                      <div className="text-xs text-[var(--muted)] mt-1">
                        신청일: {new Date(account.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>{s.text}</span>
                      {['PENDING', 'ACTIVE'].includes(account.status) && (
                        <ReturnButton accountId={account.id} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* AI 도구 신청 */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-[#E4E9F2]">
          <h2 className="text-base font-semibold mb-1">AI 도구 신청</h2>
          <p className="text-sm text-[var(--muted)] mb-5">
            신청 후 AX팀 검토 → 부서장 배정 완료 시 사용 가능합니다.
          </p>
          <ToolRequestForm activeTypes={activeTypes} />
        </section>

        {/* 반납 이력 */}
        {returned.length > 0 && (
          <section>
            <details>
              <summary className="text-sm text-[var(--muted)] cursor-pointer select-none">
                반납 이력 ({returned.length}건)
              </summary>
              <div className="mt-3 space-y-2">
                {returned.map(account => (
                  <div key={account.id} className="bg-gray-50 rounded-lg p-4 text-sm text-[var(--muted)] flex justify-between">
                    <span>{TOOL_LABEL[account.toolType] ?? account.toolType}</span>
                    <span>{account.returnedAt ? new Date(account.returnedAt).toLocaleDateString('ko-KR') : '-'}</span>
                  </div>
                ))}
              </div>
            </details>
          </section>
        )}

    </div>
  )
}
