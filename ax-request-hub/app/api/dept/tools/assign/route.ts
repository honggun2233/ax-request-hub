import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const deptHead = session.user.email

  // 이 부서장이 관리하는 쿼터 조회
  const body = await req.json()
  const { employeeEmail, quotaId, requestReason } = body

  if (!employeeEmail || !quotaId || !requestReason) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }
  if (requestReason.length < 20) {
    return NextResponse.json({ error: '배정 사유는 최소 20자 이상' }, { status: 400 })
  }

  const role = (session.user as any)?.role ?? 'EMPLOYEE'
  const ADMIN_ROLES = ['AX_TEAM', 'EXECUTIVE', 'C_LEVEL']
  const isAdmin = ADMIN_ROLES.includes(role)

  // quotaId로 직접 조회; 관리자는 모든 쿼타, 부서장은 자신이 관리하는 것만
  const quota = await prisma.departmentQuota.findFirst({
    where: isAdmin ? { id: quotaId } : { id: quotaId, managedBy: deptHead },
    include: { toolAccounts: { where: { status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } } } },
  })

  if (!quota) {
    return NextResponse.json({ error: '해당 도구 관리 권한이 없습니다.' }, { status: 403 })
  }

  const toolType = quota.toolType

  const usedCount = quota.toolAccounts.length
  if (usedCount >= quota.totalQuota) {
    return NextResponse.json({ error: `쿼터 소진 (${usedCount}/${quota.totalQuota})` }, { status: 409 })
  }

  const employee = await prisma.employee.findUnique({ where: { email: employeeEmail } })
  if (!employee) {
    return NextResponse.json({ error: '직원을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 중복 체크
  const existing = await prisma.toolAccount.findFirst({
    where: { employeeId: employee.id, toolType, status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } },
  })
  if (existing) {
    return NextResponse.json({ error: '이미 해당 도구가 배정 중이거나 활성 상태입니다.' }, { status: 409 })
  }

  const toolTierMap: Record<string, string> = {
    GPT_CHAT: 'CHAT',
    GPT_EXCEL: 'EXCEL',
    GEMINI: 'ENTERPRISE',
  }

  const account = await prisma.toolAccount.create({
    data: {
      employeeId: employee.id,
      quotaId: quota.id,
      toolType,
      toolTier: toolTierMap[toolType] ?? toolType,
      requestReason,
      assignedByEmail: deptHead,
      status: 'PENDING',
    },
  })

  return NextResponse.json(account, { status: 201 })
}
