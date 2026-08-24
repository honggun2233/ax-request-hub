import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * POST /api/registry/[id]/kpi-score
 * 월별 KPI 실적 입력 (AgentScore, phase=PRODUCTION).
 * 3개월 연속 60% 미달 시 AgentRegistry.retireFlag=true (RETIRE_CANDIDATE 자동 플래그).
 * v3 §9-1: 상용 KPI 기반 관리.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { month, kpiActual, achieveRate, note } = body;

  if (!month || achieveRate == null) {
    return NextResponse.json(
      { error: "month, achieveRate는 필수입니다 (형식: '2026-07')" },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month는 'YYYY-MM' 형식입니다" },
      { status: 400 }
    );
  }

  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) return NextResponse.json({ error: "에이전트를 찾을 수 없습니다" }, { status: 404 });
  if (agent.phase !== "PRODUCTION") {
    return NextResponse.json(
      { error: "상용(PRODUCTION) 단계 에이전트만 월별 KPI 실적을 기록할 수 있습니다" },
      { status: 400 }
    );
  }

  // upsert — 같은 달 재입력 허용
  const score = await prisma.agentScore.upsert({
    where: { agentId_phase_month: { agentId, phase: "PRODUCTION", month } },
    update: { kpiActual: kpiActual ? JSON.stringify(kpiActual) : null, achieveRate, score: achieveRate, rationale: note ?? null },
    create: {
      agentId,
      phase: "PRODUCTION",
      month,
      kpiActual: kpiActual ? JSON.stringify(kpiActual) : null,
      achieveRate,
      score: achieveRate,
      rationale: note ?? null,
    },
  });

  // 최근 3개월 연속 60% 미달 → retireFlag=true (RETIRE_CANDIDATE 자동 플래그)
  const recent3 = await prisma.agentScore.findMany({
    where: { agentId, phase: "PRODUCTION", month: { not: null } },
    orderBy: { month: "desc" },
    take: 3,
  });
  const consecutiveMiss = recent3.length === 3 && recent3.every((s) => (s.achieveRate ?? 100) < 60);

  if (consecutiveMiss && !agent.retireFlag) {
    await prisma.agentRegistry.update({
      where: { id: agentId },
      data: { retireFlag: true },
    });
    await prisma.auditLog.create({
      data: {
        entityType: "AgentRegistry",
        entityId: agentId,
        action: "RETIRE_CANDIDATE_AUTO_FLAGGED",
        actorEmail: auth.user.email,
        detail: JSON.stringify({ reason: "KPI 60% 미달 3개월 연속", months: recent3.map((s) => s.month) }),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      entityType: "AgentRegistry",
      entityId: agentId,
      action: "KPI_SCORE_RECORDED",
      actorEmail: auth.user.email,
      detail: JSON.stringify({ month, achieveRate, consecutiveMiss }),
    },
  });

  return NextResponse.json({ score, retireFlagSet: consecutiveMiss && !agent.retireFlag }, { status: 201 });
}

/**
 * GET /api/registry/[id]/kpi-score
 * 해당 에이전트의 월별 KPI 실적 목록.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;
  const auth = await requireRole();
  if ("error" in auth) return auth.error;

  const scores = await prisma.agentScore.findMany({
    where: { agentId, phase: "PRODUCTION", month: { not: null } },
    orderBy: { month: "desc" },
  });
  return NextResponse.json(scores);
}
