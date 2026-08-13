import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !["AX_TEAM", "C_LEVEL"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const policies = await prisma.distributionPolicy.findMany({
    orderBy: [{ level: "asc" }, { serviceName: "asc" }],
  })
  const allocations = await prisma.serviceAllocation.findMany({
    include: {
      employee: { select: { name: true, department: true } },
      policy: { select: { serviceName: true, level: true } },
    },
    orderBy: { grantedAt: "desc" },
    take: 50,
  })
  return NextResponse.json({ policies, allocations })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["AX_TEAM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const adminId = (session.user as any).id

  if (body.action === "grant") {
    const allocation = await prisma.serviceAllocation.create({
      data: {
        employeeId: body.employeeId,
        policyId: body.policyId,
        grantedById: adminId,
        accountInfo: body.accountInfo || "",
      },
    })
    return NextResponse.json(allocation, { status: 201 })
  }

  if (body.action === "revoke") {
    await prisma.serviceAllocation.update({
      where: { id: body.allocationId },
      data: { status: "REVOKED", revokedAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "add_policy") {
    const policy = await prisma.distributionPolicy.upsert({
      where: { level_serviceName: { level: body.level, serviceName: body.serviceName } },
      update: { isActive: true, serviceDescription: body.serviceDescription || "" },
      create: { level: body.level, serviceName: body.serviceName, serviceDescription: body.serviceDescription || "" },
    })
    return NextResponse.json(policy, { status: 201 })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
