import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entityType')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(from ? { createdAt: { gte: new Date(from) } } : {}),
        ...(to ? { createdAt: { lte: new Date(to) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    const stats = await prisma.auditLog.groupBy({ by: ['entityType'], _count: { _all: true } })
    return NextResponse.json({ logs, stats })
  } catch (err: any) {
    console.error('[governance GET]', err)
    return NextResponse.json({ error: err?.message ?? 'unknown' }, { status: 500 })
  }
}
