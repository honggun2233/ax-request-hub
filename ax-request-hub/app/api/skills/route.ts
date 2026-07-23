import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'

// GET /api/skills?category=ETF운용&status=active&q=검색어
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || ''
  const status   = searchParams.get('status')   || 'active'
  const q        = searchParams.get('q')         || ''

  const where: any = {}
  if (status !== 'all') where.status = status
  if (category && category !== '전체') where.category = category
  if (q) {
    where.OR = [
      { name:       { contains: q } },
      { purpose:    { contains: q } },
      { promptText: { contains: q } },
      { category:   { contains: q } },
    ]
  }

  const skills = await db.skill.findMany({
    where,
    include: {
      ratings: { select: { score: true } },
    },
    orderBy: [{ status: 'asc' }, { usageCount: 'desc' }, { createdAt: 'desc' }],
  })

  const result = skills.map(s => ({
    ...s,
    avgRating: s.ratings.length
      ? s.ratings.reduce((sum, r) => sum + r.score, 0) / s.ratings.length
      : null,
    ratingCount: s.ratings.length,
    ratings: undefined,
  }))

  return NextResponse.json({ skills: result })
}

// POST /api/skills  (Admin only: 스킬 등록)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any).role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const { skillId, name, category, author, purpose, instructions, promptText,
          examples, cautions, version, securityLevel, targetUsers, status } = body

  if (!skillId || !name || !category || !promptText) {
    return NextResponse.json({ error: 'skillId, name, category, promptText 필수' }, { status: 400 })
  }

  const skill = await db.skill.upsert({
    where: { skillId },
    create: {
      skillId, name, category, author: author || (session.user as any).email || '',
      purpose: purpose || '', instructions: instructions || '',
      promptText, examples: examples || '', cautions: cautions || '',
      version: version || '1.0.0',
      securityLevel: securityLevel || 'G1',
      targetUsers: JSON.stringify(targetUsers || []),
      status: status || 'draft',
    },
    update: {
      name, category, purpose: purpose || '', instructions: instructions || '',
      promptText, examples: examples || '', cautions: cautions || '',
      version: version || '1.0.0',
      securityLevel: securityLevel || 'G1',
      targetUsers: JSON.stringify(targetUsers || []),
      status: status || 'draft',
    },
  })

  return NextResponse.json({ skill })
}

// PATCH /api/skills  (Admin: 승인·상태 변경)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any).role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id, status, approvedBy } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const skill = await db.skill.update({
    where: { id },
    data: {
      status: status || undefined,
      approvedBy: approvedBy || (session.user as any).email,
      approvedAt: status === 'active' ? new Date() : undefined,
    },
  })

  return NextResponse.json({ skill })
}
