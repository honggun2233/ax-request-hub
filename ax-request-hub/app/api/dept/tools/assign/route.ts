import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const deptHead = session.user.email

  // 이 부서장이 관리하는 쿼터 조회
  const body = await req.json()
  const { employeeEmail, toolType, requestReason } = body

  if (!employeeEmail || !toolType || !requestReason) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }
  if (requestReason.length < 20) {
    return NextResponse.json({ error: '배정 사유는 최소 20자 이상' }, { status: 400 })
  }

  const quota = await db.departmentQuota.findFirst({
    where: { managedBy: deptHead, toolType },
    include: { toolAccounts: { where: { status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } } } },
  })

  if (!quota) {
    return NextResponse.json({ error: '해당 도구 관리 권한이 없습니다.' }, { status: 403 })
  }

  const usedCount = quota.toolAccounts.length
  if (usedCount >= quota.totalQuota) {
    return NextResponse.json({ error: `쿼터 소진 (${usedCount}/${quota.totalQuota})` }, { status: 409 })
  }

  const employee = await db.employee.findUnique({ where: { email: employeeEmail } })
  if (!employee) {
    return NextResponse.json({ error: '직원을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 중복 체크
  const existing = await db.toolAccount.findFirst({
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

  const account = await db.toolAccount.create({
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
