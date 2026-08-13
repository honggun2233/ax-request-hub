import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/skills/rate  { skillId, score, comment }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { skillId, score, comment } = await req.json()
  if (!skillId || typeof score !== 'number' || score < 1 || score > 5) {
    return NextResponse.json({ error: 'skillId + score(1~5) 필수' }, { status: 400 })
  }

  const skill = await prisma.skill.findUnique({ where: { id: skillId } })
  if (!skill) return NextResponse.json({ error: '스킬 없음' }, { status: 404 })

  await prisma.skillRating.upsert({
    where: { skillId_employeeEmail: { skillId, employeeEmail: session.user.email } },
    create: { skillId, employeeEmail: session.user.email, score, comment: comment || '' },
    update: { score, comment: comment || '' },
  })

  // usageCount 증가
  await prisma.skill.update({ where: { id: skillId }, data: { usageCount: { increment: 1 } } })

  return NextResponse.json({ ok: true })
}
