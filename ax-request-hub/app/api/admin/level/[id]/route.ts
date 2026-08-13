import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notify"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || !["AX_TEAM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const reviewerId = (session.user as any).id
  const body = await req.json()

  const application = await prisma.levelApplication.update({
    where: { id },
    data: {
      status: body.status,
      reviewNote: body.reviewNote || "",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
    include: { employee: true },
  })

  let toLevel: string | undefined

  if (body.status === "APPROVED") {
    const fromLevel = application.employee.currentLevel
    toLevel = body.grantLevel || application.requestedLevel

    await prisma.employee.update({
      where: { id: application.employeeId },
      data: { currentLevel: toLevel, levelGrantedAt: new Date() },
    })

    await prisma.levelHistory.create({
      data: {
        employeeId: application.employeeId,
        fromLevel,
        toLevel: toLevel ?? '',
        reason: body.reviewNote || "레벨 신청 심사 통과",
        changedById: reviewerId,
      },
    })
  }

  if (body.status === "APPROVED" && toLevel) {
    await notify(
      application.employee.email,
      `L${toLevel} 승급 완료`,
      `레벨 신청이 승인되었습니다. ${toLevel}로 승급되었습니다.`,
      "/me/level"
    )
  } else if (body.status === "REJECTED") {
    await notify(
      application.employee.email,
      "레벨 신청 반려",
      body.reviewNote || "레벨 신청이 반려되었습니다.",
      "/me/level"
    )
  }

  return NextResponse.json(application)
}
