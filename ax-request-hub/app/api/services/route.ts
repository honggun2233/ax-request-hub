import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id
  const allocations = await prisma.serviceAllocation.findMany({
    where: { employeeId: userId },
    include: { policy: true, grantedBy: { select: { name: true } } },
    orderBy: { grantedAt: "desc" },
  })
  return NextResponse.json(allocations)
}
