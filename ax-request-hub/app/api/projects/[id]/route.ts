import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await prisma.project.findUnique({ where: { id }, include: { scoreCard: true } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt, updatedAt, scoreCard, chatSession, dataRequirements, noDataRequired, ...data } = body

  const project = await prisma.project.update({
    where: { id },
    data: { ...data, noDataRequired: !!noDataRequired },
  })

  // Phase A: 제출 확정 시 데이터 요건 DRAFT로 생성 (기존 DRAFT 제거 후 새로 생성)
  if (noDataRequired !== undefined || dataRequirements) {
    await prisma.dataRequest.deleteMany({ where: { projectId: id, status: 'DRAFT' } })
    if (dataRequirements && dataRequirements.length > 0) {
      await prisma.dataRequest.createMany({
        data: dataRequirements.map((req: any) => ({
          projectId: id,
          employeeId: project.requesterEmail,
          type: req.trackType ?? 'ACCESS',
          classification: req.classification ?? 'RESTRICTED',
          purpose: req.purpose ?? project.description ?? '',
          periodMonths: req.periodMonths ?? 12,
          includesPII: req.includesPII ?? false,
          isAnonymized: false,
          forProduction: false,
          status: 'DRAFT',
          requestedSpec: req.assetDescription ?? '',
        })),
      })
    }
  }

  return NextResponse.json(project)
}
