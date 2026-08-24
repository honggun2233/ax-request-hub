import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * POST /api/dp/provisions/[id]/revoke
 * 데이터 제공 회수 — DataProvision.revokedAt 기록 + DataRequest status → REVOKED.
 * v3 §7: 데이터 프로비저닝 회수.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM", "AX_TEAM");
  if ("error" in auth) return auth.error;

  const { revokeReason } = await req.json();
  if (!revokeReason?.trim()) {
    return NextResponse.json({ error: "revokeReason(회수 사유)은 필수입니다" }, { status: 400 });
  }

  const provision = await prisma.dataProvision.findUnique({
    where: { id },
    include: { request: { select: { id: true, projectId: true } } },
  });
  if (!provision) return NextResponse.json({ error: "제공 기록을 찾을 수 없습니다" }, { status: 404 });
  if (provision.revokedAt) {
    return NextResponse.json({ error: "이미 회수된 제공 기록입니다" }, { status: 409 });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.dataProvision.update({
      where: { id },
      data: { revokedAt: now, revokeReason: revokeReason.trim() },
    }),
    prisma.dataRequest.update({
      where: { id: provision.requestId },
      data: { status: "REVOKED" },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "DataProvision",
        entityId: id,
        action: "DATA_PROVISION_REVOKED",
        actorEmail: auth.user.email,
        detail: JSON.stringify({ requestId: provision.requestId, revokeReason }),
      },
    }),
  ]);

  // 상용 운영 중 DataProvision 회수 → 연결 PRODUCTION 에이전트 자동 SUSPENDED (v3 §10-4)
  if (provision.request.projectId) {
    const prodAgent = await prisma.agentRegistry.findFirst({
      where: { projectId: provision.request.projectId, phase: "PRODUCTION", prodStatus: "ACTIVE" },
      select: { id: true, agentName: true },
    });
    if (prodAgent) {
      await prisma.agentRegistry.update({
        where: { id: prodAgent.id },
        data: { prodStatus: "SUSPENDED" },
      });
      await prisma.auditLog.create({
        data: {
          entityType: "AgentRegistry",
          entityId: prodAgent.id,
          action: "AGENT_AUTO_SUSPENDED_DATA_REVOKED",
          actorEmail: auth.user.email,
          detail: JSON.stringify({ provisionId: id, revokeReason }),
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
