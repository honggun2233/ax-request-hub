import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

export async function GET() {
  const courses = await db.literacyCourse.findMany({ include: { enrollments: true } })
  return NextResponse.json(courses)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const course = await db.literacyCourse.create({ data: body })
  return NextResponse.json(course, { status: 201 })
}
