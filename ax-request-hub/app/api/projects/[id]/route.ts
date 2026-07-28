import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await db.project.findUnique({ where: { id }, include: { scoreCard: true } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt, updatedAt, scoreCard, chatSession, ...data } = body
  const project = await db.project.update({ where: { id }, data })
  return NextResponse.json(project)
}
