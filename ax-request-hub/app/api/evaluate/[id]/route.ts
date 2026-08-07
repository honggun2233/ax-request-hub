import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvaluationAgent } from '@/src/lib/agents/evaluation'
import { determineApproval, checkTechStandards } from '@/src/lib/scoring'
import { db } from '@/src/lib/db'
import { sendApprovalEmail } from '@/src/lib/notifications/email'
import { ExtractedProject } from '@/src/lib/agents/consultation'
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
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })

  if (project.status !== 'submitted') {
    return NextResponse.json({ message: '이미 처리된 AI 활용입니다.', status: project.status })
  }

  // G3 기밀(극비) AI 활용은 Claude API 평가 생략 → 즉시 AX팀 수동 검토 에스컬레이션
  if (project.confidentialityLevel === 'G3') {
    await db.project.update({
      where: { id: project.id },
      data: { status: 'evaluated', totalScore: null },
    })
    await sendApprovalEmail({
      to: project.requesterEmail,
      projectTitle: project.title,
      totalScore: 0,
      isAutoApproved: false,
    })
    const axTeamMembers = await db.employee.findMany({
      where: { role: 'AX_TEAM', isActive: true },
      select: { email: true },
    })
    for (const member of axTeamMembers) {
      await notify(
        member.email,
        `[G3 수동검토 필요] ${project.title}`,
        `G3(극비) 기밀 등급 AI 활용으로 자동 평가가 생략되었습니다. AX팀 수동 검토가 필요합니다.`,
        `/admin?projectId=${project.id}`
      )
    }
    return NextResponse.json({
      skipped: true,
      reason: 'G3 기밀(극비) AI 활용 — Claude API 평가 생략, AX팀 수동 검토 필요',
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
      confidentialityLevel: project.confidentialityLevel as 'G1' | 'G2' | 'G3',
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
    })
    await db.project.update({
      where: { id: project.id },
      data: {
        techStandardsPassed: techResult.passed,
        techStandardsFailedItems: JSON.stringify(techResult.failedItems),
      },
    })

    await db.scoreCard.upsert({
      where: { projectId: project.id },
      update: { ...scoreCard },
      create: { projectId: project.id, ...scoreCard },
    })

    if (decision.autoApproved) {
      await db.project.update({
        where: { id: project.id },
        data: { status: 'pilot', autoApproved: true, totalScore: scoreCard.totalScore },
      })
      await sendApprovalEmail({ to: project.requesterEmail, projectTitle: project.title, totalScore: scoreCard.totalScore, isAutoApproved: true })
    } else {
      await db.project.update({
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
