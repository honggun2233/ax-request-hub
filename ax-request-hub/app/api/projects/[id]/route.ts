import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await db.project.findUnique({ where: { id }, include: { scoreCard: true } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt, updatedAt, scoreCard, chatSession, ...data } = body
  const project = await db.project.update({ where: { id }, data })
  return NextResponse.json(project)
}
