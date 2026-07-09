import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/src/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !["AX_TEAM", "C_LEVEL"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const yearMonth = new Date().toISOString().slice(0, 7)
  const [policies, usageRecords, alerts] = await Promise.all([
    db.tokenPolicy.findMany({ orderBy: [{ scope: "asc" }, { level: "asc" }] }),
    db.usageRecord.findMany({
      where: { yearMonth },
      include: { employee: { select: { name: true, department: true, currentLevel: true } } },
      orderBy: [{ service: "asc" }, { tokenUsed: "desc" }],
    }),
    db.usageAlert.findMany({ where: { yearMonth, acknowledged: false }, take: 20 }),
  ])

  const totalByService = usageRecords.reduce((acc: Record<string, number>, r) => {
    acc[r.service] = (acc[r.service] || 0) + r.tokenUsed
    return acc
  }, {})

  return NextResponse.json({ policies, usageRecords, alerts, totalByService, yearMonth })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["AX_TEAM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const adminId = (session.user as any).id
  const body = await req.json()

  if (body.action === "upsert_usage") {
    const record = await db.usageRecord.upsert({
      where: { employeeId_service_yearMonth: { employeeId: body.employeeId, service: body.service, yearMonth: body.yearMonth } },
      update: { tokenUsed: body.tokenUsed, costKrw: body.costKrw || 0, inputById: adminId },
      create: { employeeId: body.employeeId, service: body.service, yearMonth: body.yearMonth, tokenUsed: body.tokenUsed, costKrw: body.costKrw || 0, inputById: adminId },
    })

    const employee = await db.employee.findUnique({ where: { id: body.employeeId } })
    const policy = await db.tokenPolicy.findFirst({ where: { scope: "LEVEL", level: employee?.currentLevel, isActive: true } })
    if (policy && policy.monthlyLimit > 0) {
      const allUsage = await db.usageRecord.findMany({ where: { employeeId: body.employeeId, yearMonth: body.yearMonth } })
      const total = allUsage.reduce((s, r) => s + r.tokenUsed, 0)
      const pct = (total / policy.monthlyLimit) * 100

      for (const threshold of [80, 100]) {
        if (pct >= threshold) {
          const alertId = `${body.employeeId}-${body.service}-${body.yearMonth}-${threshold}`
          await db.usageAlert.upsert({
            where: { id: alertId },
            update: {},
            create: {
              id: alertId,
              employeeId: body.employeeId,
              service: body.service,
              yearMonth: body.yearMonth,
              alertType: threshold === 80 ? "WARNING_80" : "WARNING_100",
            },
          })
        }
      }
    }

    return NextResponse.json(record)
  }

  if (body.action === "upsert_policy") {
    const policyId = body.id || `${body.scope}-${body.level || "all"}-${body.service}`
    const policy = await db.tokenPolicy.upsert({
      where: { id: policyId },
      update: { monthlyLimit: body.monthlyLimit, singleCallLimit: body.singleCallLimit || 0, warningThreshold: body.warningThreshold || 80 },
      create: {
        id: policyId,
        scope: body.scope,
        level: body.level,
        service: body.service,
        monthlyLimit: body.monthlyLimit,
        singleCallLimit: body.singleCallLimit || 0,
        warningThreshold: body.warningThreshold || 80,
      },
    })
    return NextResponse.json(policy)
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
