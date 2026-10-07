import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/projects/[id]/compliance-review
// AX팀·C레벨이 고위험 과제 컴플라이언스 검토 완료를 기록 (운영규정 제8조⑤)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: '권한 없음 — AX팀 또는 C레벨만 컴플라이언스 검토 완료 처리 가능' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { note } = body as { note?: string }

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })

  if ((project as any).complianceReviewedAt) {
    return NextResponse.json({
      message: '이미 컴플라이언스 검토가 완료된 과제입니다.',
      complianceReviewedAt: (project as any).complianceReviewedAt,
      complianceReviewedBy: (project as any).complianceReviewedBy,
    })
  }

  const reviewerEmail = (session.user as any)?.email ?? (session.user as any)?.name ?? 'unknown'
  const now = new Date()

  const updated = await prisma.project.update({
    where: { id },
    data: {
      complianceReviewedAt: now,
      complianceReviewedBy: reviewerEmail,
    } as any,
  })

  await prisma.auditLog.create({
    data: {
      entityType: 'Project',
      entityId: id,
      action: 'COMPLIANCE_REVIEW_COMPLETED',
      actorEmail: reviewerEmail,
      detail: JSON.stringify({
        projectTitle: project.title,
        note: note ?? null,
        reviewedAt: now.toISOString(),
      }),
    },
  })

  return NextResponse.json({
    ok: true,
    complianceReviewedAt: now,
    complianceReviewedBy: reviewerEmail,
    message: '컴플라이언스 검토 완료가 기록되었습니다. 이제 과제를 승인할 수 있습니다.',
  })
}

// DELETE /api/projects/[id]/compliance-review — 검토 완료 취소 (C_LEVEL만)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'C_LEVEL') {
    return NextResponse.json({ error: '권한 없음 — C레벨만 컴플라이언스 검토 취소 가능' }, { status: 403 })
  }

  const { id } = await params
  await prisma.project.update({
    where: { id },
    data: { complianceReviewedAt: null, complianceReviewedBy: null } as any,
  })

  await prisma.auditLog.create({
    data: {
      entityType: 'Project',
      entityId: id,
      action: 'COMPLIANCE_REVIEW_CANCELLED',
      actorEmail: (session.user as any)?.email ?? 'unknown',
      detail: JSON.stringify({ cancelledAt: new Date().toISOString() }),
    },
  })

  return NextResponse.json({ ok: true, message: '컴플라이언스 검토 완료가 취소되었습니다.' })
}
