import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = session.user as any
  const { id } = await params

  const alert = await prisma.usageAlert.findUnique({
    where: { id },
    include: { employee: true },
  })

  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 })
  }

  const isAxTeam = user.role === "AX_TEAM"

  let isDeptHead = false
  if (!isAxTeam) {
    const quota = await prisma.departmentQuota.findFirst({
      where: {
        department: (alert.employee as any).department,
        managedBy: user.email,
      },
    })
    isDeptHead = !!quota
  }

  if (!isAxTeam && !isDeptHead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (alert.ownerApprovalStatus === "AUTO_BLOCKED") {
    return NextResponse.json(
      { error: "이미 자동 차단된 알림입니다." },
      { status: 400 }
    )
  }

  const updatedAlert = await prisma.usageAlert.update({
    where: { id },
    data: {
      ownerApprovalStatus: "APPROVED",
      ownerRespondedAt: new Date(),
      ownerRespondedBy: user.email,
    },
  })

  return NextResponse.json({ data: updatedAlert, message: "승인 완료" })
}
