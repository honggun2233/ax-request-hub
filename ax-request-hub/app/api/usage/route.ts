import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/src/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id
  const currentLevel = (session.user as any).currentLevel
  const yearMonth = new Date().toISOString().slice(0, 7)

  const [usageRecords, levelPolicy, alerts] = await Promise.all([
    db.usageRecord.findMany({ where: { employeeId: userId, yearMonth }, orderBy: { service: "asc" } }),
    db.tokenPolicy.findFirst({ where: { scope: "LEVEL", level: currentLevel, isActive: true } }),
    db.usageAlert.findMany({ where: { employeeId: userId, yearMonth, acknowledged: false } }),
  ])

  const companyPolicy = await db.tokenPolicy.findFirst({ where: { scope: "COMPANY", isActive: true } })

  const totalUsed = usageRecords.reduce((s, r) => s + r.tokenUsed, 0)
  const limit = levelPolicy?.monthlyLimit || companyPolicy?.monthlyLimit || 0
  const usagePct = limit > 0 ? Math.round((totalUsed / limit) * 100) : 0

  return NextResponse.json({ usageRecords, totalUsed, limit, usagePct, yearMonth, alerts })
}
