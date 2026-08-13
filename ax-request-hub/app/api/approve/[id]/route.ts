import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendApprovalEmail } from '@/src/lib/notifications/email'

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

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })

  // C-2: 이미 종료된 과제 재승인 방지
  if (!['submitted', 'evaluated'].includes(project.status)) {
    return NextResponse.json({ error: `현재 상태(${project.status})에서는 승인·보류·반려할 수 없습니다.` }, { status: 409 })
  }

  const typedAction = action as 'approve' | 'hold' | 'reject'
  const statusMap = { approve: 'pilot', hold: 'evaluated', reject: 'closed' } as const
  await prisma.project.update({
    where: { id },
    data: { status: statusMap[typedAction], approvedBy: (session.user as any)?.name ?? session.user?.email ?? 'unknown', decisionNote: note ?? null },
  })

  if (typedAction === 'approve') {
    // Phase A: 과제 승인 시 DRAFT DataRequest → PENDING 전환 (DATA_PLATFORM 큐 진입)
    const draftCount = await prisma.dataRequest.updateMany({
      where: { projectId: id, status: 'DRAFT' },
      data: { status: 'PENDING' },
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
    })
  }

  return NextResponse.json({ ok: true, status: statusMap[typedAction] })
}
