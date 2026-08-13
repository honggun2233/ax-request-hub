import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const courses = await prisma.literacyCourse.findMany({
    include: {
      enrollments: {
        include: { employee: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { isRequired: 'desc' },
  })
  return NextResponse.json(courses)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const course = await prisma.literacyCourse.create({ data: body })
  return NextResponse.json(course, { status: 201 })
}
