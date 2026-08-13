import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const quotas = await prisma.departmentQuota.findMany({
    include: {
      toolAccounts: { where: { status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] } }, select: { id: true } },
    },
    orderBy: [{ department: 'asc' }, { toolType: 'asc' }],
  })

  return NextResponse.json(quotas.map(q => ({
    ...q,
    usedCount: q.toolAccounts.length,
    toolAccounts: undefined,
  })))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { department, toolType, totalQuota, aiDensity, managedBy } = await req.json()

  const quota = await prisma.departmentQuota.upsert({
    where: { department_toolType: { department, toolType } },
    create: { department, toolType, totalQuota: totalQuota ?? 0, aiDensity: aiDensity ?? 'STANDARD', managedBy: managedBy ?? '' },
    update: { totalQuota: totalQuota ?? 0, aiDensity: aiDensity ?? 'STANDARD', managedBy: managedBy ?? '' },
  })

  return NextResponse.json(quota, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, totalQuota, managedBy, aiDensity } = await req.json()

  const updated = await prisma.departmentQuota.update({
    where: { id },
    data: {
      ...(totalQuota !== undefined && { totalQuota }),
      ...(managedBy !== undefined && { managedBy }),
      ...(aiDensity !== undefined && { aiDensity }),
    },
  })

  return NextResponse.json(updated)
}
