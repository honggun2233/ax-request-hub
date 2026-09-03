import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { checkTechStandards } from '@/src/lib/scoring'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireRole('AX_TEAM')
  const { id } = await params
  const body = await req.json()

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } })
  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })

  const {
    techHasApiSpec,
    techHasDataClassification,
    techHasAuditLogging,
    techHasTestCoverage,
    techHasDataQualityCheck,
    techHasHumanInLoop,
  } = body

  // 체크리스트 값 병합 후 통과 여부 재계산
  const current = await prisma.project.findUnique({
    where: { id },
    select: {
      techHasApiSpec: true, techHasDataClassification: true,
      techHasAuditLogging: true, techHasTestCoverage: true,
      techHasDataQualityCheck: true, techHasHumanInLoop: true,
    },
  })

  const merged = {
    hasApiSpec:            techHasApiSpec            ?? current?.techHasApiSpec            ?? false,
    hasDataClassification: techHasDataClassification ?? current?.techHasDataClassification ?? false,
    hasAuditLogging:       techHasAuditLogging       ?? current?.techHasAuditLogging       ?? false,
    hasTestCoverage:       techHasTestCoverage       ?? current?.techHasTestCoverage       ?? false,
    hasDataQualityCheck:   techHasDataQualityCheck   ?? current?.techHasDataQualityCheck   ?? false,
    hasHumanInLoop:        techHasHumanInLoop        ?? current?.techHasHumanInLoop        ?? false,
  }

  const { passed, failedItems } = checkTechStandards(merged)

  const updated = await prisma.project.update({
    where: { id },
    data: {
      techHasApiSpec:            techHasApiSpec            ?? undefined,
      techHasDataClassification: techHasDataClassification ?? undefined,
      techHasAuditLogging:       techHasAuditLogging       ?? undefined,
      techHasTestCoverage:       techHasTestCoverage       ?? undefined,
      techHasDataQualityCheck:   techHasDataQualityCheck   ?? undefined,
      techHasHumanInLoop:        techHasHumanInLoop        ?? undefined,
      techStandardsPassed:       passed,
      techStandardsFailedItems:  JSON.stringify(failedItems),
    },
    select: {
      id: true,
      techHasApiSpec: true, techHasDataClassification: true,
      techHasAuditLogging: true, techHasTestCoverage: true,
      techHasDataQualityCheck: true, techHasHumanInLoop: true,
      techStandardsPassed: true, techStandardsFailedItems: true,
    },
  })

  return NextResponse.json(updated)
}
