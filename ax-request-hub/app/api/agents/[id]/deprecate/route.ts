import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const VALID_REASONS = ['DUPLICATE', 'PERFORMANCE', 'POLICY_CHANGE', 'SCOPE_CHANGE', 'OTHER']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { deprecationReason, retirementNote, successorAgentId } = body

  if (!deprecationReason || !VALID_REASONS.includes(deprecationReason)) {
    return NextResponse.json({ error: 'deprecationReason is required and must be valid' }, { status: 400 })
  }

  const agent = await db.agent.update({
    where: { id },
    data: {
      status: 'DEPRECATED',
      deprecatedAt: new Date(),
      deprecationReason,
      retirementNote: retirementNote || null,
      successorAgentId: successorAgentId || null,
    },
  })
  return NextResponse.json(agent)
}
