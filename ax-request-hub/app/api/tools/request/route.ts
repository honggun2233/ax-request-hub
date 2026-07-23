import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const employee = await db.employee.findUnique({ where: { email: session.user.email } })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  const accounts = await db.toolAccount.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const employee = await db.employee.findUnique({ where: { email: session.user.email } })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  const body = await req.json()
  const { toolType, toolTier, requestReason } = body

  if (!toolType || !toolTier || !requestReason) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  }
  if (requestReason.length < 20) {
    return NextResponse.json({ error: '신청 사유는 최소 20자 이상 입력해주세요.' }, { status: 400 })
  }

  // 중복 신청 방지 (PENDING/APPROVED/ACTIVE 상태인 같은 도구)
  const existing = await db.toolAccount.findFirst({
    where: {
      employeeId: employee.id,
      toolType,
      status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
    },
  })
  if (existing) {
    return NextResponse.json({ error: '이미 해당 도구 계정이 신청 중이거나 활성 상태입니다.' }, { status: 409 })
  }

  const account = await db.toolAccount.create({
    data: {
      employeeId: employee.id,
      toolType,
      toolTier,
      requestReason,
      status: 'PENDING',
    },
  })

  return NextResponse.json(account, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  // 사용자가 자신의 신청을 취소 (PENDING → RETURNED)
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const employee = await db.employee.findUnique({ where: { email: session.user.email } })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  const body = await req.json()
  const { id } = body

  const account = await db.toolAccount.findUnique({ where: { id } })
  if (!account || account.employeeId !== employee.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!['PENDING', 'ACTIVE'].includes(account.status)) {
    return NextResponse.json({ error: '취소/반납 불가 상태입니다.' }, { status: 400 })
  }

  const updated = await db.toolAccount.update({
    where: { id },
    data: { status: 'RETURNED', returnedAt: new Date() },
  })

  return NextResponse.json(updated)
}
