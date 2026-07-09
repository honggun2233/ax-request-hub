import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const employee = await db.employee.findUnique({ where: { email: session.user.email } })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  const [allocations, usageAgg, tokenPolicy, recentApplications] = await Promise.all([
    db.serviceAllocation.findMany({
      where: { employeeId: employee.id, status: 'ACTIVE' },
      include: { policy: { select: { serviceName: true } } }
    }),
    db.usageRecord.aggregate({ where: { employeeId: employee.id, yearMonth }, _sum: { tokenUsed: true } }),
    db.tokenPolicy.findFirst({ where: { level: employee.currentLevel } }),
    db.levelApplication.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' }, take: 5
    })
  ])

  const services = allocations.map(a => ({
    id: a.id,
    serviceName: a.policy.serviceName,
    status: a.status,
    createdAt: a.grantedAt,
  }))

  return NextResponse.json({
    employee,
    services,
    tokenUsed: usageAgg._sum.tokenUsed ?? 0,
    tokenLimit: tokenPolicy?.monthlyLimit ?? 0,
    recentApplications,
  })
}
