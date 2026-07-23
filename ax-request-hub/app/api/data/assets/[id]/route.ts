import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const asset = await prisma.dataAsset.findUnique({
      where: { id },
      include: {
        _count: { select: { requests: true } },
      },
    })

    if (!asset) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(asset)
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
    if (role !== 'DATA_PLATFORM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const { name, description, ownerDept, classification, deliveryModes, updateCycle, schemaMeta, isActive } = body
    const data = Object.fromEntries(
      Object.entries({ name, description, ownerDept, classification, deliveryModes, updateCycle, schemaMeta, isActive })
        .filter(([, v]) => v !== undefined)
    )

    const asset = await prisma.dataAsset.update({
      where: { id },
      data,
    })

    return NextResponse.json(asset)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
