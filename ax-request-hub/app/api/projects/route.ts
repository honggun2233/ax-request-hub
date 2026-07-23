import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

export async function GET(req: NextRequest) {
  const auth = await requireRole()
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const mine = searchParams.get('mine') === '1'

  const where: any = {}
  if (mine) {
    where.requesterEmail = auth.user.email
  } else if (!['AX_TEAM', 'C_LEVEL', 'EXECUTIVE'].includes(auth.user.role)) {
    // 일반 직원은 자신의 과제만 조회
    where.requesterEmail = auth.user.email
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      scoreCard: true,
      agentRegistries: {
        select: { devStage: true, phase: true, prodStatus: true },
        take: 1,
      },
      appeals: {
        where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 응답 형태 정리: agent, pendingAppeal 필드로 정규화
  const result = projects.map((p) => ({
    ...p,
    agent: p.agentRegistries?.[0] ?? null,
    pendingAppeal: (p.appeals?.length ?? 0) > 0,
    agentRegistries: undefined,
    appeals: undefined,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const project = await prisma.project.create({
    data: { ...body, source: 'ax_discovery' },
  })
  return NextResponse.json(project, { status: 201 })
}
