import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireRole('AX_TEAM')
  const { id } = await params
  const body = await req.json()

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } })
  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })

  const { techHasApiSpec, techHasDataClassification, techHasAuditLogging, techHasTestCoverage } = body

  const updated = await prisma.project.update({
    where: { id },
    data: {
      techHasApiSpec:            techHasApiSpec            ?? undefined,
      techHasDataClassification: techHasDataClassification ?? undefined,
      techHasAuditLogging:       techHasAuditLogging       ?? undefined,
      techHasTestCoverage:       techHasTestCoverage        ?? undefined,
    },
    select: {
      id: true,
      techHasApiSpec: true, techHasDataClassification: true,
      techHasAuditLogging: true, techHasTestCoverage: true,
      techStandardsPassed: true, techStandardsFailedItems: true,
    },
  })

  return NextResponse.json(updated)
}
