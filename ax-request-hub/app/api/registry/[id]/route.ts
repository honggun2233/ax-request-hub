import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * GET /api/registry/[id]
 * 에이전트 단건 조회 — 로그인 사용자 누구나 조회 가능.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole();
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const agent = await prisma.agentRegistry.findUnique({
    where: { id },
    select: {
      id: true,
      agentName: true,
      phase: true,
      devStage: true,
      prodStatus: true,
      retireFlag: true,
      pilotKpiTarget: true,
      prodKpiTarget: true,
      owner: true,
      projectId: true,
      lifecycleStage: true,
      trustScore: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "에이전트를 찾을 수 없습니다" }, { status: 404 });
  }

  // retireFlag 발동 근거: AuditLog에서 RETIRE_CANDIDATE_AUTO_FLAGGED 조회
  let retireFlagReason: string | null = null;
  let retireFlagMonths: string[] = [];
  if (agent.retireFlag) {
    const log = await prisma.auditLog.findFirst({
      where: { entityType: "AgentRegistry", entityId: id, action: "RETIRE_CANDIDATE_AUTO_FLAGGED" },
      orderBy: { createdAt: "desc" },
      select: { detail: true, createdAt: true },
    });
    if (log) {
      const parsed = JSON.parse(log.detail ?? "{}");
      retireFlagMonths = parsed.months ?? [];
      retireFlagReason = `KPI 60% 미달 3개월 연속 (${retireFlagMonths.join(", ")}) — ${new Date(log.createdAt).toLocaleDateString("ko-KR")} 자동 플래그`;
    }
  }

  return NextResponse.json({ ...agent, retireFlagReason, retireFlagMonths });
}
