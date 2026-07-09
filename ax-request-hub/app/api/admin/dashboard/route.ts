import { NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

export async function GET() {
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  const [activeEmployees, monthlyTokens, pendingApplications, activeProjects] = await Promise.all([
    db.employee.count({ where: { isActive: true, currentLevel: { not: 'L0' } } }),
    db.usageRecord.aggregate({ where: { yearMonth }, _sum: { tokenUsed: true } }),
    db.levelApplication.count({ where: { status: 'PENDING' } }),
    db.project.count({ where: { status: { in: ['submitted', 'evaluated', 'pilot'] } } }),
  ])

  const recentApplications = await db.levelApplication.findMany({
    take: 5, orderBy: { createdAt: 'desc' },
    include: { employee: { select: { name: true, department: true } } }
  })

  const recentProjects = await db.project.findMany({
    take: 5, orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, department: true, totalScore: true, status: true, createdAt: true }
  })

  const applicationTrend = await db.levelApplication.findMany({
    where: { createdAt: { gte: sixtyDaysAgo } },
    select: { createdAt: true }
  })

  const serviceUsage = await db.usageRecord.groupBy({
    by: ['service'], where: { yearMonth },
    _sum: { tokenUsed: true }
  })

  return NextResponse.json({
    activeEmployees,
    monthlyTokens: monthlyTokens._sum.tokenUsed ?? 0,
    pendingApplications,
    activeProjects,
    recentApplications,
    recentProjects,
    applicationTrend,
    serviceUsage: serviceUsage.map(s => ({ serviceName: s.service, _sum: s._sum })),
  })
}
