import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { courseId, action } = await req.json()
    if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

    const employee = await db.employee.findUnique({ where: { email: session.user.email } })
    if (!employee) return NextResponse.json({ error: '직원 정보 없음' }, { status: 404 })

    if (action === 'complete') {
      // Upsert enrollment and mark completed
      const enrollment = await db.literacyEnrollment.upsert({
        where: { employeeId_courseId: { employeeId: employee.id, courseId } },
        create: { employeeId: employee.id, courseId, status: 'COMPLETED', completedAt: new Date() },
        update: { status: 'COMPLETED', completedAt: new Date() },
      })
      return NextResponse.json(enrollment)
    } else {
      // Enroll (start)
      const enrollment = await db.literacyEnrollment.upsert({
        where: { employeeId_courseId: { employeeId: employee.id, courseId } },
        create: { employeeId: employee.id, courseId, status: 'IN_PROGRESS' },
        update: { status: 'IN_PROGRESS' },
      })
      return NextResponse.json(enrollment)
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })
  }
}
