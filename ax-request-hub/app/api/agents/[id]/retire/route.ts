import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any)?.role
  if (!['AX_TEAM', 'C_LEVEL'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden: AX_TEAM or C_LEVEL required' }, { status: 403 })
  }

  const agent = await db.agent.findUnique({
    where: { id },
    include: { knowledgeExtracts: true },
  })
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  if (agent.status !== 'DEPRECATED') {
    return NextResponse.json({ error: 'Agent must be DEPRECATED first' }, { status: 400 })
  }

  if (!agent.deprecatedAt) {
    return NextResponse.json({ error: 'deprecatedAt missing' }, { status: 400 })
  }

  const daysSince = (Date.now() - new Date(agent.deprecatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince < 30) {
    return NextResponse.json(
      { error: `30일 유예기간 미경과 (${Math.floor(daysSince)}일 경과)` },
      { status: 400 }
    )
  }

  if (agent.knowledgeExtracts.length === 0) {
    return NextResponse.json({ error: '지식 추출 없이 RETIRED 불가' }, { status: 400 })
  }

  const updated = await db.agent.update({
    where: { id },
    data: { status: 'RETIRED', retiredAt: new Date() },
  })
  return NextResponse.json(updated)
}
