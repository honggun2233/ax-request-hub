import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvaluationAgent } from '@ssam/agents'
import { determineApproval, checkTechStandards } from '@ssam/scoring'
import { prisma } from '@/lib/prisma'
import { sendApprovalEmail } from '@ssam/notifications'
import { ExtractedProject } from '@ssam/agents'
import { notify } from '@/lib/notify'

// P1-2: Telegram 알림 제거 — 외부 개인 메신저 사용 불가 (금융회사 망분리·기록보존 컴플라이언스)
// 사내 채널 연동은 추후 결정 시 이 위치에 추가

const evaluationAgent = new EvaluationAgent()

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: '권한 없음 — AX팀 또는 C레벨만 평가 실행 가능' }, { status: 403 })
  }
  const { id } = await params
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })

  if (project.status !== 'submitted') {
    return NextResponse.json({ message: '이미 처리된 AI 활용입니다.', status: project.status })
  }

  // 고영향 AI·고성능 AI → 고위험 자동 승격 (운영규정 제10조③)
  // evaluate 전에 판별하여 AX팀 수동 검토로 에스컬레이션
  if ((project as any).isHighImpactAI || (project as any).isHighCapabilityAI) {
    const flagLabel = (project as any).isHighImpactAI ? '고영향 AI' : '고성능 AI'
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'evaluated', totalScore: null },
    })
    await sendApprovalEmail({ to: project.requesterEmail, projectTitle: project.title, totalScore: 0, isAutoApproved: false })
    await prisma.councilAgendaItem.create({
      data: {
        projectId: project.id,
        itemType: 'HIGH_RISK_REJECTION',
        packageMeta: JSON.stringify({
          reason: `${flagLabel} 판별 → 위험등급 고위험 자동 승격`,
          projectTitle: project.title,
          requesterName: project.requesterName,
          requesterEmail: project.requesterEmail,
          receivedAt: new Date().toISOString(),
        }),
      },
    })
    // AX팀 + 소속 부서장 동시 알림 (운영규정 제16조①)
    const [axTeamMembers, deptHead] = await Promise.all([
      prisma.employee.findMany({ where: { role: 'AX_TEAM', isActive: true }, select: { email: true } }),
      prisma.employee.findFirst({ where: { department: project.department, role: 'DEPT_HEAD', isActive: true }, select: { email: true } }),
    ])
    const notifyTargets = [...axTeamMembers.map(m => m.email), ...(deptHead ? [deptHead.email] : [])]
    for (const email of notifyTargets) {
      await notify(prisma, email,
        `[고위험 자동승격] ${project.title}`,
        `${flagLabel}로 판별되어 위험등급이 고위험으로 자동 승격되었습니다. 수동 검토가 필요합니다.`,
        `/admin?projectId=${project.id}`
      )
    }
    return NextResponse.json({ skipped: true, reason: `${flagLabel}: 고위험 자동 승격, AX팀 수동 검토 필요`, status: 'evaluated' })
  }

  // CONFIDENTIAL(기밀·극비) AI 활용은 Claude API 평가 생략 → 즉시 AX팀 수동 검토 에스컬레이션
  if (project.confidentialityLevel === 'CONFIDENTIAL') {
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'evaluated', totalScore: null },
    })
    await sendApprovalEmail({
      to: project.requesterEmail,
      projectTitle: project.title,
      totalScore: 0,
      isAutoApproved: false,
    })

    // 위원회 안건 자동 생성 — 미배정(meetingId: null) 상태로 접수
    await prisma.councilAgendaItem.create({
      data: {
        agentId: null,
        projectId: project.id,
        itemType: 'HIGH_RISK_REJECTION',
        packageMeta: JSON.stringify({
          reason: 'CONFIDENTIAL 등급',
          projectTitle: project.title,
          requesterName: project.requesterName,
          requesterEmail: project.requesterEmail,
          receivedAt: new Date().toISOString(),
        }),
      },
    })

    // AX팀 + 소속 부서장 동시 알림 (운영규정 제16조①)
    const [axTeamMembers, deptHead] = await Promise.all([
      prisma.employee.findMany({ where: { role: 'AX_TEAM', isActive: true }, select: { email: true } }),
      prisma.employee.findFirst({ where: { department: project.department, role: 'DEPT_HEAD', isActive: true }, select: { email: true } }),
    ])
    const notifyTargets = [...axTeamMembers.map(m => m.email), ...(deptHead ? [deptHead.email] : [])]
    for (const email of notifyTargets) {
      await notify(prisma, email,
        `[CONFIDENTIAL 수동검토 필요] ${project.title}`,
        `CONFIDENTIAL 등급 AI 활용으로 자동 평가가 생략되었습니다. AX팀 전체 수동 검토가 필요합니다.`,
        `/admin?projectId=${project.id}`
      )
    }
    return NextResponse.json({
      skipped: true,
      reason: 'CONFIDENTIAL 등급: AI 평가 생략, AX팀 전체 수동 검토 필요',
      status: 'evaluated',
    })
  }

  try {
    const extracted: ExtractedProject = {
      title: project.title,
      department: project.department,
      requesterName: project.requesterName,
      requesterEmail: project.requesterEmail,
      description: project.description,
      asIs: project.asIs,
      expectedBenefit: project.expectedBenefit,
      confidentialityLevel: project.confidentialityLevel as 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL',
      championName: project.championName,
      estimatedUsers: project.estimatedUsers,
    }
    const scoreCard = await evaluationAgent.evaluate(extracted)
    const decision = determineApproval(extracted.confidentialityLevel, scoreCard.totalScore)

    // Gate 2: 기술 표준 체크리스트 평가
    const techResult = checkTechStandards({
      hasApiSpec: project.techHasApiSpec,
      hasDataClassification: project.techHasDataClassification,
      hasAuditLogging: project.techHasAuditLogging,
      hasTestCoverage: project.techHasTestCoverage,
      hasDataQualityCheck: project.techHasDataQualityCheck,
      hasHumanInLoop: project.techHasHumanInLoop,
    })
    await prisma.project.update({
      where: { id: project.id },
      data: {
        techStandardsPassed: techResult.passed,
        techStandardsFailedItems: JSON.stringify(techResult.failedItems),
      },
    })

    await prisma.scoreCard.upsert({
      where: { projectId: project.id },
      update: { ...scoreCard },
      create: { projectId: project.id, ...scoreCard },
    })

    if (decision.autoApproved) {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'pilot', autoApproved: true, totalScore: scoreCard.totalScore },
      })
      await sendApprovalEmail({ to: project.requesterEmail, projectTitle: project.title, totalScore: scoreCard.totalScore, isAutoApproved: true })
    } else {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'evaluated', totalScore: scoreCard.totalScore },
      })
      await sendApprovalEmail({ to: project.requesterEmail, projectTitle: project.title, totalScore: scoreCard.totalScore, isAutoApproved: false })
    }
    return NextResponse.json({ scoreCard, decision, techStandards: techResult })
  } catch (error) {
    console.error('Evaluation error:', error)
    return NextResponse.json({ error: '평가 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
}
