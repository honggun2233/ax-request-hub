import { NextRequest, NextResponse } from 'next/server'
import { EvaluationAgent } from '@/src/lib/agents/evaluation'
import { determineApproval, checkTechStandards } from '@/src/lib/scoring'
import { db } from '@/src/lib/db'
import { sendTelegramApprovalRequest, sendTelegramNotification } from '@/src/lib/notifications/telegram'
import { sendApprovalEmail } from '@/src/lib/notifications/email'
import { ExtractedProject } from '@/src/lib/agents/consultation'

const evaluationAgent = new EvaluationAgent()

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })

  // 이미 평가 완료된 경우 중복 알림 방지
  if (project.status !== 'submitted') {
    return NextResponse.json({ message: '이미 처리된 과제입니다.', status: project.status })
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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    if (decision.autoApproved) {
      await db.project.update({
        where: { id: project.id },
        data: { status: 'pilot', autoApproved: true, totalScore: scoreCard.totalScore },
      })
      await sendApprovalEmail({ to: project.requesterEmail, projectTitle: project.title, totalScore: scoreCard.totalScore, isAutoApproved: true })
      await sendTelegramNotification(`✅ 자동 승인: ${project.title} (${scoreCard.totalScore.toFixed(1)}점) — ${project.department}`)
    } else {
      await db.project.update({
        where: { id: project.id },
        data: { status: 'evaluated', totalScore: scoreCard.totalScore },
      })
      const gate2Note = techResult.passed
        ? ''
        : `\n⚠️ Gate2 미충족: ${techResult.failedItems.join(', ')}`
      await sendTelegramApprovalRequest({
        projectId: project.id, title: project.title, department: project.department,
        totalScore: scoreCard.totalScore, rationale: scoreCard.evaluationRationale + gate2Note,
        approvalUrl: `${baseUrl}/dashboard?review=${project.id}`,
      })
      await sendApprovalEmail({ to: project.requesterEmail, projectTitle: project.title, totalScore: scoreCard.totalScore, isAutoApproved: false })
    }
    return NextResponse.json({ scoreCard, decision, techStandards: techResult })
  } catch (error) {
    await db.project.update({ where: { id: project.id }, data: { status: 'evaluated' } })
    await sendTelegramNotification(`⚠️ 평가 오류 — ${project.title}: 수동 검토 필요`)
    console.error('Evaluation error:', error)
    return NextResponse.json({ error: '평가 오류, 수동 검토 대상으로 등록됨' }, { status: 500 })
  }
}
