import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { status, sdsRequested } = await req.json()
  const validStatuses = ['APPROVED', 'ACTIVE', 'SUSPENDED', 'RETURNED']

  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: '유효하지 않은 상태값' }, { status: 400 })
  }

  const now = new Date()
  const updated = await prisma.toolAccount.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(status === 'APPROVED' && { approvedBy: session.user?.email ?? '', approvedAt: now }),
      ...(status === 'ACTIVE' && { activatedAt: now }),
      ...(status === 'RETURNED' && { returnedAt: now }),
    },
    include: { employee: { select: { name: true, email: true, department: true } } },
  })

  return NextResponse.json(updated)
}
