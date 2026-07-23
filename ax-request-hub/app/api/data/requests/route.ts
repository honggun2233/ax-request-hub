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
    } = body

    const dataRequest = await prisma.dataRequest.create({
      data: {
        type,
        projectId,
        requesterId: userId,
        purpose,
        classification,
        periodMonths,
        ...(assetId !== undefined ? { assetId } : {}),
        ...(agentId !== undefined ? { agentId } : {}),
        ...(requestedSpec !== undefined ? { requestedSpec } : {}),
        ...(forProduction !== undefined ? { forProduction } : {}),
      },
    })

    return NextResponse.json(dataRequest, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
