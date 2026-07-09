import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/src/lib/db"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || !["AX_TEAM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const reviewerId = (session.user as any).id
  const body = await req.json()

  const application = await db.levelApplication.update({
    where: { id },
    data: {
      status: body.status,
      reviewNote: body.reviewNote || "",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
    include: { employee: true },
  })

  if (body.status === "APPROVED") {
    const fromLevel = application.employee.currentLevel
    const toLevel = body.grantLevel || application.requestedLevel

    await db.employee.update({
      where: { id: application.employeeId },
      data: { currentLevel: toLevel, levelGrantedAt: new Date() },
    })

    await db.levelHistory.create({
      data: {
        employeeId: application.employeeId,
        fromLevel,
        toLevel,
        reason: body.reviewNote || "레벨 신청 심사 통과",
        changedById: reviewerId,
      },
    })
  }

  return NextResponse.json(application)
}
