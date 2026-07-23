import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

    if (role !== 'DATA_PLATFORM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { status, rejectReason } = body

    const dataRequest = await prisma.dataRequest.update({
      where: { id },
      data: {
        status,
        reviewerId: userId,
        ...(rejectReason !== undefined ? { rejectReason } : {}),
      },
    })

    return NextResponse.json(dataRequest)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
