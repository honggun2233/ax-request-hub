import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'
import { sendApprovalEmail } from '@/src/lib/notifications/email'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    await sendApprovalEmail({ to: project.requesterEmail, projectTitle: project.title, totalScore: project.totalScore ?? 0, isAutoApproved: false })
  }
  return NextResponse.json({ ok: true, status: statusMap[action] })
}
