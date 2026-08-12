import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id
  const applications = await prisma.levelApplication.findMany({
    where: { employeeId: userId },
    orderBy: { createdAt: "desc" },
  })

  const employee = await prisma.employee.findUnique({ where: { id: userId } })

  return NextResponse.json({ applications, currentLevel: employee?.currentLevel })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id
  const body = await req.json()

  const existing = await prisma.levelApplication.findFirst({
    where: { employeeId: userId, status: { in: ["PENDING", "REVIEWING"] } },
  })
  if (existing) {
    return NextResponse.json({ error: "이미 심사 중인 신청이 있습니다" }, { status: 400 })
  }

  const employee = await prisma.employee.findUnique({ where: { id: userId } })

  const application = await prisma.levelApplication.create({
    data: {
      employeeId: userId,
      requestedLevel: body.requestedLevel,
      currentLevel: employee?.currentLevel || "L0",
      selfIntro: body.selfIntro || "",
      trainingCompleted: body.trainingCompleted || "",
      utilizationPlan: body.utilizationPlan || "",
      recommendationNote: body.recommendationNote || "",
    },
  })

  return NextResponse.json(application, { status: 201 })
}
