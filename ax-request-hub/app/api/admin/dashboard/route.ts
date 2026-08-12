import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const [activeEmployees, monthlyTokens, pendingApplications, activeProjects] = await Promise.all([
      prisma.employee.count({ where: { isActive: true, currentLevel: { not: 'L0' } } }),
      prisma.usageRecord.aggregate({ where: { yearMonth }, _sum: { tokenUsed: true } }),
      prisma.levelApplication.count({ where: { status: 'PENDING' } }),
      prisma.project.count({ where: { status: { in: ['submitted', 'evaluated', 'pilot'] } } }),
    ])

    const recentApplications = await prisma.levelApplication.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      include: { employee: { select: { name: true, department: true } } }
    })

    const recentProjects = await prisma.project.findMany({
      take: 5, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, department: true, totalScore: true, status: true, createdAt: true }
    })

    const applicationTrend = await prisma.levelApplication.findMany({
      where: { createdAt: { gte: sixtyDaysAgo } },
      select: { createdAt: true }
    })

    const serviceUsage = await prisma.usageRecord.groupBy({
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })
  }
}
