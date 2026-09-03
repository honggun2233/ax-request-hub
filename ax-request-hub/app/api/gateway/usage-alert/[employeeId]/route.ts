import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = session.user as any
  const { employeeId } = await params

  const employee = await prisma.employee.findUnique({
    where: { employeeId },
  })

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const isSelf = user.id === employee.id
  const isAxTeam = user.role === "AX_TEAM"

  let isDeptHead = false
  if (!isSelf && !isAxTeam) {
    const quota = await prisma.departmentQuota.findFirst({
      where: {
        department: (employee as any).department,
        managedBy: user.email,
      },
    })
    isDeptHead = !!quota
  }

  if (!isSelf && !isAxTeam && !isDeptHead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const yearMonth = new Date().toISOString().slice(0, 7)

  const alerts = await prisma.usageAlert.findMany({
    where: {
      employeeId: employee.id,
      yearMonth,
    },
    orderBy: { createdAt: "desc" },
  })

  const overLimitAlert = alerts.find(
    (a) => a.alertType === "OVER_LIMIT" && a.graceStartedAt !== null
  ) ?? null

  const graceStatus = {
    isInGrace:
      overLimitAlert !== null &&
      overLimitAlert.ownerApprovalStatus === "PENDING",
    ownerApprovalStatus: overLimitAlert?.ownerApprovalStatus ?? null,
    graceStartedAt: overLimitAlert?.graceStartedAt ?? null,
    callsSinceOverage: overLimitAlert?.callsSinceOverage ?? 0,
    daysElapsed:
      overLimitAlert?.graceStartedAt != null
        ? Math.floor(
            (Date.now() - overLimitAlert.graceStartedAt.getTime()) / 86400000
          )
        : null,
  }

  return NextResponse.json({
    data: {
      employee: {
        id: employee.id,
        name: employee.name,
        employeeId: employee.employeeId,
      },
      yearMonth,
      alerts,
      graceStatus,
    },
  })
}
