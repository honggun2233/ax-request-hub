import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const employee = await db.employee.findUnique({ where: { email: session.user.email } })

  const courses = await db.literacyCourse.findMany({
    where: { isActive: true },
    include: {
      enrollments: employee ? { where: { employeeId: employee.id } } : undefined
    }
  })
  return NextResponse.json(courses)
}
