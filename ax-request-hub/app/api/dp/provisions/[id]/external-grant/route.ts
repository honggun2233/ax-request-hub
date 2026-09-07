import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole('DATA_PLATFORM')
  if ('error' in auth) return auth.error

  const provision = await prisma.dataProvision.findUnique({
    where: { id },
    include: {
      request: {
        include: { asset: { select: { sourceSystem: true, name: true } } },
      },
    },
  })
  if (!provision) {
    return NextResponse.json({ error: '프로비전을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (provision.externalGranted) {
    return NextResponse.json({ error: '이미 처리됐습니다.' }, { status: 409 })
  }

  const updated = await prisma.dataProvision.update({
    where: { id },
    data: {
      externalGranted: true,
      externalGrantedAt: new Date(),
      externalGrantedBy: auth.user.email,
    },
  })

  await prisma.auditLog.create({
    data: {
      entityType: 'DataProvision',
      entityId: id,
      action: 'EXTERNAL_GRANT_CONFIRMED',
      actorEmail: auth.user.email,
      detail: JSON.stringify({
        sourceSystem: provision.request.asset?.sourceSystem ?? null,
      }),
    },
  })

  return NextResponse.json(updated)
}
