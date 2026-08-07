import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const ALLOWED_ROLES = ['AX_TEAM', 'C_LEVEL']

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const role = (session.user as any)?.role
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  if (!body.useCaseSummary?.trim() || !body.lessonsLearned?.trim())
    return NextResponse.json({ error: 'useCaseSummary와 lessonsLearned는 필수 항목입니다' }, { status: 400 })

  const agent = await db.agent.findUnique({ where: { id } })
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  const extract = await db.agentKnowledgeExtract.create({
    data: {
      agentId: id,
      promptPatterns: body.promptPatterns || null,
      failureCases: body.failureCases || null,
      useCaseSummary: body.useCaseSummary,
      lessonsLearned: body.lessonsLearned,
      extractedBy: session.user?.email ?? 'unknown',
    },
  })
  return NextResponse.json(extract, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any)?.role
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const extractId = req.nextUrl.searchParams.get('extractId')
  if (!extractId) return NextResponse.json({ error: 'extractId required' }, { status: 400 })

  await db.agentKnowledgeExtract.delete({ where: { id: extractId } })
  return new NextResponse(null, { status: 204 })
}
