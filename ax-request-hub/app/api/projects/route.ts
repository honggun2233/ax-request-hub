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
  const auth = await requireRole()
  if ('error' in auth) return auth.error

  try {
    const body = await req.json()
    const { dataRequirements, noDataRequired, ...projectData } = body

    // Q1: 데이터 요건 선언 강제 — 둘 다 없으면 거부
    if (!noDataRequired && (!dataRequirements || dataRequirements.length === 0)) {
      return NextResponse.json(
        { error: '데이터 요건을 선언하거나 "별도 데이터 불필요"를 선택해야 합니다.' },
        { status: 400 }
      )
    }

    const project = await prisma.project.create({
      data: {
        ...projectData,
        noDataRequired: !!noDataRequired,
        source: projectData.source ?? 'ax_discovery',
        // 데이터 요건은 과제 승인 시점에 DataRequest로 변환 (approve API에서 처리)
        // 임시 보관: description에 JSON으로 삽입하지 않고 별도 필드 없이 body만 전달
      },
    })

    // dataRequirements를 DRAFT 상태로 미리 생성 (승인 시 PENDING으로 전환)
    if (dataRequirements && dataRequirements.length > 0) {
      const requester = await prisma.employee.findUnique({
        where: { email: projectData.requesterEmail },
        select: { id: true },
      })
      if (requester) {
        await prisma.dataRequest.createMany({
          data: dataRequirements.map((req: any) => ({
            projectId: project.id,
            requesterId: requester.id,
            type: req.trackType ?? 'ACCESS',
            classification: req.classification ?? 'G2',
            purpose: req.purpose ?? projectData.description ?? '',
            periodMonths: req.periodMonths ?? 12,
            includesPII: req.includesPII ?? false,
            isAnonymized: false,
            forProduction: false,
            status: 'DRAFT',
            requestedSpec: req.assetDescription ?? '',
          })),
        })
      } else {
        return NextResponse.json(
          { error: '신청자 이메일을 찾을 수 없습니다. requesterEmail을 확인해주세요.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(project, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })
  }
}
