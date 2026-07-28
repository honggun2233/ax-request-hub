import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'

// 지정 가능한 역할 — AX_TEAM만 DEPT_HEAD를 지정할 수 있음
const ASSIGNABLE_ROLES = ['DEPT_HEAD', 'EMPLOYEE'] as const
type AssignableRole = typeof ASSIGNABLE_ROLES[number]

// PATCH /api/admin/users/[id]/role
// Body: { role: 'DEPT_HEAD' | 'EMPLOYEE', reason?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: '권한 없음 — AX팀만 역할 지정 가능' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { role, reason } = body as { role: AssignableRole; reason?: string }

  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `유효하지 않은 역할. 허용: ${ASSIGNABLE_ROLES.join(', ')}` },
      { status: 400 }
    )
  }

  const target = await db.employee.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ error: '직원을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (['AX_TEAM', 'C_LEVEL', 'EXECUTIVE'].includes(target.role)) {
    return NextResponse.json(
      { error: `${target.role} 역할은 이 API로 변경할 수 없습니다.` },
      { status: 403 }
    )
  }

  const updated = await db.employee.update({
    where: { id },
    data: { role },
    select: { id: true, employeeId: true, name: true, department: true, role: true },
  })

  await db.auditLog.create({
    data: {
      entityType: 'Employee',
      entityId: id,
      action: 'ROLE_CHANGE',
      actorEmail: (session.user as any)?.email ?? 'unknown',
      detail: JSON.stringify({
        from: target.role,
        to: role,
        reason: reason ?? '',
      }),
    },
  })

  return NextResponse.json({ employee: updated })
}

// GET /api/admin/users/[id]/role — 현재 역할 조회
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await params
  const employee = await db.employee.findUnique({
    where: { id },
    select: { id: true, employeeId: true, name: true, department: true, role: true },
  })
  if (!employee) {
    return NextResponse.json({ error: '직원을 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ employee })
}
