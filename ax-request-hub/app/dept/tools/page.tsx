import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/src/lib/db'
import { RevokeButton, DeptAssignForm, AdminActionButtons, SuspendButton } from './DeptToolActions'

const TOOL_LABEL: Record<string, string> = {
  GPT_CHAT: 'ChatGPT (Chat)',
  GPT_EXCEL: 'ChatGPT (Excel)',
  GEMINI: 'Gemini Enterprise',
}

const TOOL_LIMIT: Record<string, number> = {
  GPT_CHAT: 100,
  GPT_EXCEL: 50,
  GEMINI: 50,
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING:   { text: '처리 중', color: 'text-yellow-600 bg-yellow-50' },
  APPROVED:  { text: '승인됨',  color: 'text-blue-600 bg-blue-50' },
  ACTIVE:    { text: '사용 중', color: 'text-green-600 bg-green-50' },
  SUSPENDED: { text: '정지',    color: 'text-red-600 bg-red-50' },
  RETURNED:  { text: '반납됨',  color: 'text-[var(--muted)] bg-gray-50' },
}

const ADMIN_ROLES = ['AX_TEAM', 'EXECUTIVE', 'C_LEVEL']

function quotaStatus(pct: number, remaining: number) {
  if (remaining <= 0)  return { label: '소진', badge: 'bg-red-100 text-red-700',      bar: 'bg-red-500',    row: 'bg-red-50' }
  if (pct >= 80)       return { label: '부족', badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-400', row: 'bg-orange-50/40' }
  if (pct >= 50)       return { label: '주의', badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400', row: '' }
  return               { label: '여유', badge: 'bg-green-100 text-green-700',          bar: 'bg-green-500',  row: '' }
}

export default async function DeptToolsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')

  const email = session.user.email
  const role = (session.user as any)?.role ?? 'EMPLOYEE'
  const isAdmin = ADMIN_ROLES.includes(role)

  if (!isAdmin && role !== 'DEPT_HEAD') redirect('/me')

  const quotas = await db.departmentQuota.findMany({
    where: isAdmin ? {} : { managedBy: email },
    include: {
      toolAccounts: {
        include: { employee: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ toolType: 'asc' }, { department: 'asc' }],
  })

  // AX팀 전용 데이터
  let totalByTool: { toolType: string; _count: { id: number } }[] = []
  let pending: any[] = []

  if (isAdmin) {
    ;[totalByTool, pending] = await Promise.all([
      db.toolAccount.groupBy({
        by: ['toolType'],
        where: { status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } },
        _count: { id: true },
      }),
      db.toolAccount.findMany({
        where: { status: 'PENDING' },
        include: {
          employee: { select: { name: true, email: true, department: true } },
          quota: { select: { department: true, toolType: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])
  }

  const usageMap = Object.fromEntries(totalByTool.map(t => [t.toolType, t._count.id]))
  const deptLabel = isAdmin ? '전사 관리' : (quotas[0]?.department ?? '내 부서')

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-bold">AI 도구 배정 관리</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{deptLabel} · {isAdmin ? 'AX팀 통합 관리' : '부서장 관리'}</p>
        </div>

        {/* ── AX팀 전용: 전사 게이지 ─────────────────────────────── */}
        {isAdmin && (
          <section>
            <h2 className="text-base font-semibold mb-3">전사 도구 사용 현황</h2>
            <div className="grid grid-cols-3 gap-4">
              {(['GPT_CHAT', 'GPT_EXCEL', 'GEMINI'] as const).map(toolType => {
                const used = usageMap[toolType] ?? 0
                const limit = TOOL_LIMIT[toolType]
                const pct = Math.min(100, Math.round((used / limit) * 100))
                const { bar } = quotaStatus(pct, limit - used)
                return (
                  <div key={toolType} className="bg-white rounded-xl p-5 shadow-sm">
                    <div className="text-sm font-medium mb-3">{TOOL_LABEL[toolType]}</div>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-3xl font-bold">{used}</span>
                      <span className="text-[var(--muted)] text-sm mb-1">/ {limit}석</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">{pct}% 사용</div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── AX팀 전용: PENDING 처리 ──────────────────────────────── */}
        {isAdmin && pending.length > 0 && (
          <section>
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
                  {pending.map((acc: any) => (
                    <tr key={acc.id}>
                      <td className="p-4">
                        <div className="font-medium">{acc.employee.name}</div>
                        <div className="text-xs text-[var(--muted)]">{acc.employee.email}</div>
                      </td>
                      <td className="p-4 text-[var(--muted)]">{acc.quota?.department ?? acc.employee.department}</td>
                      <td className="p-4">{TOOL_LABEL[acc.toolType as string] ?? acc.toolType}</td>
                      <td className="p-4 text-[var(--muted)]">{new Date(acc.createdAt).toLocaleDateString('ko-KR')}</td>
                      <td className="p-4"><AdminActionButtons accId={acc.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── AX팀 전용: 부서별 쿼터 현황 (상태 표시) ─────────────── */}
        {isAdmin && (
          <section>
            <h2 className="text-base font-semibold mb-3">부서별 쿼터 현황</h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-600">부서</th>
                    <th className="text-left p-4 font-medium text-gray-600">도구</th>
                    <th className="text-left p-4 font-medium text-gray-600">사용량</th>
                    <th className="text-left p-4 font-medium text-gray-600">잔여</th>
                    <th className="text-left p-4 font-medium text-gray-600">상태</th>
                    <th className="text-left p-4 font-medium text-gray-600">부서장</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {quotas.map(q => {
                    const used = q.toolAccounts.filter(a => ['PENDING','APPROVED','ACTIVE'].includes(a.status)).length
                    const remaining = q.totalQuota - used
                    const pct = q.totalQuota > 0 ? Math.min(100, Math.round((used / q.totalQuota) * 100)) : 100
                    const { label, badge, bar, row } = quotaStatus(pct, remaining)
                    return (
                      <tr key={q.id} className={row}>
                        <td className="p-4 font-medium">{q.department}</td>
                        <td className="p-4 text-gray-600">{TOOL_LABEL[q.toolType] ?? q.toolType}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-100 rounded-full h-1.5 shrink-0">
                              <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-[var(--muted)] whitespace-nowrap">{used} / {q.totalQuota}석</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`font-medium ${remaining <= 0 ? 'text-red-600' : remaining <= 2 ? 'text-orange-500' : 'text-gray-700'}`}>
                            {remaining}석
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{label}</span>
                        </td>
                        <td className="p-4 text-[var(--muted)] text-xs">{q.managedBy || '미지정'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-2 px-1 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />여유 (&lt;50%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />주의 (50–79%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />부족 (80–99%)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />소진 (100%)</span>
            </div>
          </section>
        )}

        {/* ── 부서별 배정 현황 (DEPT_HEAD: 자기 부서만 / AX팀: 전체) ── */}
        <section>
          <h2 className="text-base font-semibold mb-3">배정 현황</h2>
          {quotas.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-[var(--muted)] shadow-sm">
              등록된 AI 도구 쿼터가 없습니다. AX팀에 문의하세요.
            </div>
          ) : (
            <div className="space-y-6">
              {quotas.map(q => {
                const members = q.toolAccounts.filter(a => a.status !== 'RETURNED')
                return (
                  <div key={q.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold">{TOOL_LABEL[q.toolType] ?? q.toolType}</span>
                        <span className="ml-2 text-xs text-[var(--muted)]">{q.department}</span>
                      </div>
                      <span className="text-xs text-[var(--muted)]">
                        {members.length} / {q.totalQuota}석 배정
                      </span>
                    </div>
                    {members.length === 0 ? (
                      <div className="px-5 py-6 text-center text-[var(--muted)] text-sm">배정된 팀원이 없습니다.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="border-b bg-white">
                          <tr>
                            <th className="text-left p-4 font-medium text-[var(--muted)] text-xs">이름</th>
                            <th className="text-left p-4 font-medium text-[var(--muted)] text-xs">이메일</th>
                            <th className="text-left p-4 font-medium text-[var(--muted)] text-xs">상태</th>
                            <th className="text-left p-4 font-medium text-[var(--muted)] text-xs">배정일</th>
                            <th className="p-4"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {members.map(acc => {
                            const s = STATUS_LABEL[acc.status] ?? { text: acc.status, color: '' }
                            return (
                              <tr key={acc.id}>
                                <td className="p-4 font-medium">{acc.employee.name}</td>
                                <td className="p-4 text-[var(--muted)]">{acc.employee.email}</td>
                                <td className="p-4">
                                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.color}`}>{s.text}</span>
                                </td>
                                <td className="p-4 text-[var(--muted)]">{new Date(acc.createdAt).toLocaleDateString('ko-KR')}</td>
                                <td className="p-4 flex gap-2">
                                  {isAdmin && (acc.status === 'ACTIVE' || acc.status === 'SUSPENDED') && (
                                    <SuspendButton accountId={acc.id} currentStatus={acc.status} name={acc.employee.name} />
                                  )}
                                  <RevokeButton accountId={acc.id} name={acc.employee.name} />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── 신규 배정 신청 ──────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold mb-3">신규 배정 신청</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm max-w-lg">
            <DeptAssignForm quotas={quotas.map(q => ({
              id: q.id,
              toolType: q.toolType,
              department: q.department,
              remaining: q.totalQuota - q.toolAccounts.filter(a => ['PENDING','APPROVED','ACTIVE'].includes(a.status)).length,
            }))} />
          </div>
        </section>

      </div>
    </div>
  )
}
