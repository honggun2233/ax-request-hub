import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const logs = await db.auditLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(from ? { createdAt: { gte: new Date(from) } } : {}),
      ...(to ? { createdAt: { lte: new Date(to) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const stats = await db.auditLog.groupBy({ by: ['entityType'], _count: true })
  return NextResponse.json({ logs, stats })
}
