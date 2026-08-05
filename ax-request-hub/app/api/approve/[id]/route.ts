import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'
import { sendApprovalEmail } from '@/src/lib/notifications/email'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: '권한 없음 — AX팀 또는 C레벨만 승인 가능' }, { status: 403 })
  }

  const { id } = await params
  const { action, note }: { action: 'approve' | 'hold' | 'reject'; note?: string } = await req.json()
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })
  const statusMap = { approve: 'pilot', hold: 'evaluated', reject: 'closed' } as const
  await db.project.update({
    where: { id },
    data: { status: statusMap[action], approvedBy: '홍인표 팀장', decisionNote: note ?? null },
  })

  if (action === 'approve') {
    // Phase A: 과제 승인 시 DRAFT DataRequest → PENDING 전환 (DATA_PLATFORM 큐 진입)
    const draftCount = await db.dataRequest.updateMany({
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
      status: statusMap[action],
      dataRequestsActivated: draftCount.count, // 자동 생성된 데이터 신청 수
    })
  }

  return NextResponse.json({ ok: true, status: statusMap[action] })
}
