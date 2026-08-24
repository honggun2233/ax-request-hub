import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * GET /api/dp/requests
 * DATA_PLATFORM 전용 데이터 신청 처리 큐.
 * AX_TEAM은 읽기 전용(RO)으로 접근 가능.
 * v3 §7: 데이터 프로비저닝 워크플로우.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole("DATA_PLATFORM", "AX_TEAM");
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const where = status ? { status } : {};

  const requests = await prisma.dataRequest.findMany({
    where,
    include: {
      asset: { select: { id: true, name: true, classification: true } },
      project: { select: { id: true, title: true, department: true } },
      provision: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}
