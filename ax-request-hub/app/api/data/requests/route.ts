import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any)?.role
    const userId = (session.user as any)?.id

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const isAdmin = role === 'DATA_PLATFORM' || role === 'AX_TEAM'

    const requests = await prisma.dataRequest.findMany({
      where: {
        ...(isAdmin ? {} : { requesterId: userId }),
        ...(status ? { status } : {}),
      },
      include: {
        asset: { select: { name: true, classification: true } },
        project: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(requests)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = (session.user as any)?.id

    const body = await req.json()
    const {
      type,
      projectId,
      assetId,
      agentId,
      purpose,
      classification,
      periodMonths,
      requestedSpec,
      forProduction,
      trackType,
      accessType,
      isAnonymized,
      anonNote,
      prevRequestId,
    } = body

    // Validate required fields
    if (!type || !purpose?.trim() || !classification || !periodMonths) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다' }, { status: 400 })
    }

    // Validate projectId FK if provided
    const resolvedProjectId: string | null = projectId?.trim() || null
    if (resolvedProjectId) {
      const exists = await prisma.project.findUnique({ where: { id: resolvedProjectId }, select: { id: true } })
      if (!exists) {
        return NextResponse.json({ error: `AI 활용 ID "${resolvedProjectId}"를 찾을 수 없습니다` }, { status: 400 })
      }
    }

    // Validate assetId FK if provided
    const resolvedAssetId: string | null = assetId?.trim() || null
    if (resolvedAssetId) {
      const exists = await prisma.dataAsset.findUnique({ where: { id: resolvedAssetId }, select: { id: true } })
      if (!exists) {
        return NextResponse.json({ error: `데이터 자산 ID "${resolvedAssetId}"를 찾을 수 없습니다` }, { status: 400 })
      }
    }

    const dataRequest = await prisma.dataRequest.create({
      data: {
        type,
        requesterId: userId,
        purpose,
        classification,
        periodMonths: Number(periodMonths),
        ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
        ...(resolvedAssetId ? { assetId: resolvedAssetId } : {}),
        ...(agentId ? { agentId } : {}),
        ...(requestedSpec !== undefined ? { requestedSpec } : {}),
        ...(forProduction !== undefined ? { forProduction: Boolean(forProduction) } : {}),
        ...(trackType ? { trackType } : {}),
        ...(accessType ? { accessType } : {}),
        ...(isAnonymized !== undefined ? { isAnonymized: Boolean(isAnonymized) } : {}),
        ...(anonNote ? { anonNote } : {}),
        ...(prevRequestId ? { prevRequestId } : {}),
      },
    })

    return NextResponse.json(dataRequest, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
