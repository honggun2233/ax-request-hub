import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const GRACE_DAYS = 7
    const GRACE_CALL_LIMIT = 20

    const alerts = await prisma.usageAlert.findMany({
      where: {
        alertType: "OVER_LIMIT",
        ownerApprovalStatus: "PENDING",
        graceStartedAt: { not: null },
      },
    })

    let expired = 0

    const results = await Promise.allSettled(
      alerts.map(async (alert) => {
        const graceStartedAt = alert.graceStartedAt!
        const daysElapsed = (now.getTime() - graceStartedAt.getTime()) / (1000 * 60 * 60 * 24)

        const conditionA = daysElapsed >= GRACE_DAYS
        const conditionB = alert.callsSinceOverage >= GRACE_CALL_LIMIT

        if (!conditionA && !conditionB) return

        await prisma.usageAlert.update({
          where: { id: alert.id },
          data: { ownerApprovalStatus: "AUTO_BLOCKED" },
        })

        const employee = await prisma.employee.findUnique({
          where: { id: alert.employeeId },
        })

        if (!employee) return

        const deptQuota = await prisma.departmentQuota.findFirst({
          where: { department: employee.department },
        })

        const deptHeadEmail = deptQuota?.managedBy ?? null

        const recipients = [
          ...new Set(
            [employee.email, deptHeadEmail, "ax-team@company.com"].filter(Boolean) as string[]
          ),
        ]

        const body = `${employee.name}님의 ${alert.service} 사용량 한도 초과 유예가 만료되어 자동 차단되었습니다. (유예 기간: ${Math.floor(daysElapsed)}일, 누적 호출: ${alert.callsSinceOverage}회)`

        await prisma.notification.createMany({
          data: recipients.map((email) => ({
            recipientEmail: email,
            title: "AI 사용량 유예 기간 만료 — 자동 차단",
            body,
            link: "/admin/cost-guardrail",
          })),
        })

        expired++
      })
    )

    const failures = results.filter((r) => r.status === "rejected")
    if (failures.length > 0) {
      console.error(`[grace-expiry] ${failures.length} alert(s) failed to process:`, failures)
    }

    return NextResponse.json({
      processed: alerts.length,
      expired,
      message: "유예 만료 감시 완료",
    })
  } catch (error) {
    console.error("[grace-expiry] Unhandled error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
