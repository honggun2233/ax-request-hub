import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { notify } from '@/lib/notify'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole()
  if ('error' in auth) return auth.error

  const { note, artifacts } = await req.json()

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, requesterEmail: true, handoverRequestedAt: true },
  })

  if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })

  if (project.status !== 'pilot')
    return NextResponse.json({ error: '파일럿 승인 단계에서만 인수 신청 가능합니다.' }, { status: 422 })

  if (project.requesterEmail !== auth.user.email)
    return NextResponse.json({ error: '신청자 본인만 인수 신청할 수 있습니다.' }, { status: 403 })

  if (project.handoverRequestedAt)
    return NextResponse.json({ error: '이미 인수 신청이 완료됐습니다.' }, { status: 409 })

  const updated = await prisma.project.update({
    where: { id },
    data: {
      handoverRequestedAt: new Date(),
      handoverNote: note ?? null,
      handoverArtifacts: artifacts ? JSON.stringify(artifacts) : null,
    },
  })

  // AX팀 전체 알림
  const axTeamEmails = await prisma.employee.findMany({
    where: { role: 'AX_TEAM' },
    select: { email: true },
  }).then(r => r.map(e => e.email))

  await notify(
    {
      type: 'TASK_ESCALATED',
      title: `인수 신청 — ${project.title}`,
      body: `${auth.user.name ?? project.requesterEmail}님이 PoC를 완료하고 AX팀 검토를 요청했습니다.`,
      link: `/admin?handover=${id}`,
      metadata: { projectId: id },
    },
    axTeamEmails,
  )

  await prisma.auditLog.create({
    data: {
      entityType: 'Project',
      entityId: id,
      action: 'HANDOVER_REQUESTED',
      actorEmail: auth.user.email,
      detail: JSON.stringify({ note, artifactsProvided: !!artifacts }),
    },
  })

  return NextResponse.json(updated)
}
