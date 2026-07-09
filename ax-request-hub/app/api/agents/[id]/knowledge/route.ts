import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const extracts = await db.agentKnowledgeExtract.findMany({ where: { agentId: id } })
  return NextResponse.json(extracts)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const extract = await db.agentKnowledgeExtract.create({
    data: {
      agentId: id,
      promptPatterns: body.promptPatterns || null,
      failureCases: body.failureCases || null,
      useCaseSummary: body.useCaseSummary || null,
      lessonsLearned: body.lessonsLearned || null,
      extractedBy: session.user?.email ?? 'unknown',
    },
  })
  return NextResponse.json(extract, { status: 201 })
}
