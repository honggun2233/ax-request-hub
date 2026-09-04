import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const role = (session.user as any).role
  if (role !== "AX_TEAM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { agentId } = await params

  const logs = await prisma.policyDecisionLog.findMany({
    where: { agentId },
    orderBy: { checkedAt: "desc" },
    take: 50,
    include: {
      employee: {
        select: { name: true, employeeId: true },
      },
    },
  })

  return NextResponse.json({
    data: logs,
    total: logs.length,
  })
}
