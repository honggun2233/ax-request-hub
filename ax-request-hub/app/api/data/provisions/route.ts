import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // 개발 단계: role 제한 없음
    const userId = (session.user as any)?.id

    const body = await req.json()
    const { requestId, deliveryMode, connectionRef, expiresAt } = body

    const provision = await prisma.dataProvision.create({
      data: {
        requestId,
        deliveryMode,
        connectionRef,
        expiresAt: new Date(expiresAt),
      },
    })

    await prisma.dataRequest.update({
      where: { id: requestId },
      data: { status: 'PROVISIONED', reviewerId: userId },
    })

    return NextResponse.json(provision, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
