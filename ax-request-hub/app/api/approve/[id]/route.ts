import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendApprovalEmail } from '@ssam/notifications'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: '권한 없음 — AX팀 또는 C레벨만 승인 가능' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { action, note } = body

  const VALID_ACTIONS = ['approve', 'hold', 'reject']
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: '유효하지 않은 action입니다.' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: { scoreCard: { select: { id: true } } },
  }) as any
  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })

  // C-2: 이미 종료된 과제 재승인 방지
  if (!['submitted', 'evaluated'].includes(project.status)) {
    return NextResponse.json({ error: `현재 상태(${project.status})에서는 승인·보류·반려할 수 없습니다.` }, { status: 409 })
  }

  // ScoreCard 가드 — 채점 없이 승인 불가
  if (action === 'approve' && !project.scoreCard) {
    return NextResponse.json(
      { error: 'ScoreCard가 없습니다. Gate3 채점을 먼저 완료해야 승인할 수 있습니다.' },
      { status: 422 }
    )
  }

  // 고위험 과제 컴플라이언스 검토 완료 가드 (운영규정 제8조⑤ — 생략·단축 불가 명문화)
  const isHighRisk = project.confidentialityLevel === 'CONFIDENTIAL'
    || (project.totalScore ?? 0) >= 80
    || project.isHighImpactAI
    || project.isHighCapabilityAI
  if (action === 'approve' && isHighRisk && !project.complianceReviewedAt) {
    return NextResponse.json(
      { error: '고위험 과제는 컴플라이언스 검토 완료 후 승인할 수 있습니다. (운영규정 제8조⑤) 컴플라이언스팀 검토 완료 확인 후 재시도하세요.' },
      { status: 422 }
    )
  }

  // Gate1a/Gate1b 분리 (v6)
  // Gate1a: agentType·scope·기밀등급·업무기술 등 데이터 무관 항목 → 이미 제출 시 검증됨
  // Gate1b: 데이터 요건이 있으면 DataRequest 전건 승인 여부 확인
  if (action === 'approve' && !(project as any).noDataRequired) {
    const pendingDataRequests = await prisma.dataRequest.count({
      where: {
        projectId: id,
        status: { in: ['REQUESTED', 'PENDING', 'REVIEWING', 'SEC_REVIEW', 'DRAFT'] },
      },
    })
    if (pendingDataRequests > 0) {
      // failedGate 기록
      await prisma.project.update({
        where: { id },
        data: { failedGate: 'GATE1B' } as any,
      })
      return NextResponse.json(
        {
          error: `Gate1b 대기 — 데이터 요청 ${pendingDataRequests}건이 승인되지 않았습니다. DATA_PLATFORM팀 승인 후 재시도하세요.`,
          failedGate: 'GATE1B',
          pendingDataRequests,
        },
        { status: 422 }
      )
    }
  }

  // Gate 통과 시 failedGate 초기화
  if (action === 'approve') {
    await prisma.project.update({ where: { id }, data: { failedGate: null } as any })
  }

  const typedAction = action as 'approve' | 'hold' | 'reject'
  const statusMap = { approve: 'pilot', hold: 'evaluated', reject: 'closed' } as const
  await prisma.project.update({
    where: { id },
    data: { status: statusMap[typedAction], approvedBy: (session.user as any)?.name ?? session.user?.email ?? 'unknown', decisionNote: note ?? null },
  })

  // AuditLog 기록
  await prisma.auditLog.create({
    data: {
      entityType: 'Project',
      entityId: id,
      action: typedAction === 'approve' ? 'APPROVED' : typedAction === 'hold' ? 'HELD' : 'REJECTED',
      actorEmail: (session.user as any)?.email ?? 'unknown',
      detail: JSON.stringify({ note, targetStatus: statusMap[typedAction] }),
    },
  })

  if (typedAction === 'approve') {
    // Phase A: 과제 승인 시 DRAFT DataRequest → PENDING 전환 (DATA_PLATFORM 큐 진입)
    const draftCount = await prisma.dataRequest.updateMany({
      where: { projectId: id, status: 'DRAFT' },
      data: { status: 'PENDING' },
    })

    // 상용 전환 승인 경로 차등화 (운영규정 제9조)
    // 고위험·기밀 → AI위원회 의결 필수 안건 생성
    // 저·중위험 → AI실무협의체 전결 (시스템 외 프로세스), 차기 AI위원회 보고용 안건만 생성
    await prisma.councilAgendaItem.create({
      data: {
        projectId: id,
        itemType: isHighRisk ? 'PROD_APPROVAL' : 'PRACTICAL_COMMITTEE_REVIEW',
        packageMeta: JSON.stringify({
          approvedBy: (session.user as any)?.email,
          approvalPath: isHighRisk ? 'AI위원회' : 'AI실무협의체',
          totalScore: project.totalScore,
          confidentialityLevel: project.confidentialityLevel,
          projectTitle: project.title,
          approvedAt: new Date().toISOString(),
        }),
      },
    })

    await sendApprovalEmail({
      to: project.requesterEmail,
      projectTitle: project.title,
      totalScore: project.totalScore ?? 0,
      isAutoApproved: false,
    })

    return NextResponse.json({
      ok: true,
      status: statusMap[typedAction],
      dataRequestsActivated: draftCount.count,
      approvalPath: isHighRisk ? 'AI위원회' : 'AI실무협의체',
    })
  }

  // 과제 반려(reject) 시 PROVISIONED DataRequest 전건 자동 REVOKED (v3 §10-3)
  if (typedAction === 'reject') {
    const provisionedRequests = await prisma.dataRequest.findMany({
      where: { projectId: id, status: 'PROVISIONED' },
      select: { id: true },
    })
    if (provisionedRequests.length > 0) {
      const requestIds = provisionedRequests.map((r: { id: string }) => r.id)
      const revokeNow = new Date()
      await prisma.dataProvision.updateMany({
        where: { requestId: { in: requestIds }, revokedAt: null },
        data: { revokedAt: revokeNow, revokeReason: `과제 반려(REJECTED): ${id}` },
      })
      await prisma.dataRequest.updateMany({
        where: { id: { in: requestIds } },
        data: { status: 'REVOKED' },
      })
    }
  }

  return NextResponse.json({ ok: true, status: statusMap[typedAction] })
}
