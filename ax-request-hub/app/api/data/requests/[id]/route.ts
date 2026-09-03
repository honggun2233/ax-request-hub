import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAffectedAgents } from '@/lib/impact-graph'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any)?.role
    const userId = (session.user as any)?.id

    const isAdmin = role === 'DATA_PLATFORM' || role === 'AX_TEAM'

    const { id } = await params
    const dataRequest = await prisma.dataRequest.findUnique({
      where: { id },
      include: {
        asset: true,
        project: true,
        provision: true,
      },
    })

    if (!dataRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (!isAdmin && dataRequest.requesterId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(dataRequest)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any)?.role
    const userId = (session.user as any)?.id

    if (role !== 'DATA_PLATFORM' && role !== 'AX_TEAM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { status, rejectReason } = body

    // G3 데이터 승인 선결조건: 과제의 isEssentialBusiness가 true여야 함
    if (status === 'APPROVED') {
      const dr = await prisma.dataRequest.findUnique({
        where: { id },
        select: { classification: true, projectId: true },
      })
      if (dr?.classification === 'CONFIDENTIAL' && dr.projectId) {
        const project = await prisma.project.findUnique({
          where: { id: dr.projectId },
          select: { isEssentialBusiness: true } as any,
        }) as any
        if (project && !project.isEssentialBusiness) {
          return NextResponse.json(
            { error: 'G3(기밀) 데이터 승인을 위해서는 과제가 "본질적 업무"로 지정되어야 합니다. 과제 신청자에게 업무 필수성 확인 후 재요청하세요.' },
            { status: 422 }
          )
        }
      }
    }

    const dataRequest = await prisma.dataRequest.update({
      where: { id },
      data: {
        status,
        reviewerId: userId,
        ...(rejectReason !== undefined ? { rejectReason } : {}),
      },
      include: { asset: { select: { id: true } }, provision: { select: { id: true } } },
    })

    // AuditLog 기록 — 모든 DataRequest 상태 전이 (v3 §10-3)
    await prisma.auditLog.create({
      data: {
        entityType: 'DataRequest',
        entityId: id,
        action: `DATA_REQUEST_${status}`,
        actorEmail: (session.user as any)?.email ?? 'unknown',
        detail: JSON.stringify({ status, rejectReason: rejectReason ?? null }),
      },
    })

    // REVOKE 처리: 영향도 엔진으로 연관 에이전트 일괄 SUSPENDED
    if (status === 'REVOKED') {
      const assetId = dataRequest.asset?.id
      if (assetId) {
        const affected = await getAffectedAgents(assetId)
        const affectedIds = affected.map(a => a.agentId)

        if (affectedIds.length > 0) {
          await prisma.agentRegistry.updateMany({
            where: { id: { in: affectedIds } },
            data: { lifecycleStage: 'SUSPENDED' },
          })

          await prisma.auditLog.create({
            data: {
              entityType: 'DataRequest',
              entityId: id,
              action: 'AGENTS_SUSPENDED_ON_REVOKE',
              actorEmail: (session.user as any)?.email ?? 'unknown',
              detail: JSON.stringify({
                assetId,
                suspendedCount: affectedIds.length,
                agentIds: affectedIds,
              }),
            },
          })
        }
      }

      // DataProvision에 revokedAt 기록
      if (dataRequest.provision?.id) {
        await prisma.dataProvision.update({
          where: { id: dataRequest.provision.id },
          data: { revokedAt: new Date() },
        })
      }
    }

    return NextResponse.json(dataRequest)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
