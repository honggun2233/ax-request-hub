import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/admin/agents/flags
// performanceFlag가 null이 아닌 에이전트 목록 반환 (AX팀 월별 체크용)
export async function GET() {
  try {
    const flagged = await prisma.agent.findMany({
      where: {
        performanceFlag: { not: null },
      },
      select: {
        id: true,
        name: true,
        department: true,
        status: true,
        kpiName: true,
        kpiTarget: true,
        kpiLastScore: true,
        kpiMissCount: true,
        performanceFlag: true,
        lastUsedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(flagged)
  } catch (err: any) {
    console.error('[admin/agents/flags GET]', err)
    return NextResponse.json({ error: err?.message ?? 'unknown' }, { status: 500 })
  }
}
