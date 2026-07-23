import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const classification = searchParams.get('classification')
    const ownerDept = searchParams.get('ownerDept')
    const isActiveParam = searchParams.get('isActive')
    const isActive = isActiveParam === 'false' ? false : true

    const assets = await prisma.dataAsset.findMany({
      where: {
        isActive,
        ...(classification ? { classification } : {}),
        ...(ownerDept ? { ownerDept } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { requests: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(assets)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const role = (session.user as any)?.role
    if (role !== 'DATA_PLATFORM') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, ownerDept, classification, deliveryModes, updateCycle, schemaMeta } = body

    const asset = await prisma.dataAsset.create({
      data: {
        name,
        description,
        ownerDept,
        classification,
        deliveryModes,
        ...(updateCycle !== undefined ? { updateCycle } : {}),
        ...(schemaMeta !== undefined ? { schemaMeta } : {}),
      },
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
