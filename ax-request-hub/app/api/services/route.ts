import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/src/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id
  const allocations = await db.serviceAllocation.findMany({
    where: { employeeId: userId },
    include: { policy: true, grantedBy: { select: { name: true } } },
    orderBy: { grantedAt: "desc" },
  })
  return NextResponse.json(allocations)
}
