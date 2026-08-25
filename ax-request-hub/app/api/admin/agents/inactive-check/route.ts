import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { isCronAuthorized } from "@/lib/cron";

const INACTIVE_MONTHS = 12;

/**
 * POST /api/admin/agents/inactive-check
 * 12개월 미사용 에이전트 자동 DEPRECATED 배치 — architecture v3 §7-2.
 * "12개월 미사용 (lastUsedAt) → AX팀 직권 DEPRECATED (협의회 사후 보고)"
 * 일 1회 실행 권장. ACTIVE 상태만 대상.
 */
export async function POST(req: NextRequest) {
  // CRON_SECRET 인증 또는 AX_TEAM 세션 인증
  let actorEmail = "SYSTEM";
  if (!isCronAuthorized(req)) {
    const auth = await requireRole("AX_TEAM");
    if ("error" in auth) return auth.error;
    actorEmail = auth.user.email;
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - INACTIVE_MONTHS);

  // ACTIVE이고 lastUsedAt이 12개월 이전(또는 한번도 사용 안 됨)인 PRODUCTION 에이전트
  const targets = await prisma.agentRegistry.findMany({
    where: {
      phase: "PRODUCTION",
      prodStatus: "ACTIVE",
      OR: [
        { lastUsedAt: { lte: cutoff } },
        { lastUsedAt: null },
      ],
    },
    select: { id: true, name: true, agentName: true, lastUsedAt: true },
  });

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, deprecatedCount: 0, message: "12개월 이상 미사용 에이전트 없음" });
  }

  const now = new Date();
  let deprecatedCount = 0;
  for (const agent of targets) {
    await prisma.$transaction([
      prisma.agentRegistry.update({
        where: { id: agent.id },
        data: { prodStatus: "DEPRECATED" },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "AgentRegistry",
          entityId: agent.id,
          action: "AGENT_AUTO_DEPRECATED_INACTIVE",
          actorEmail: "SYSTEM",
          detail: JSON.stringify({
            reason: `${INACTIVE_MONTHS}개월 이상 미사용`,
            lastUsedAt: agent.lastUsedAt ?? null,
            cutoff: cutoff.toISOString(),
            triggeredBy: actorEmail,
          }),
        },
      }),
    ]);
    deprecatedCount++;
  }

  return NextResponse.json({
    ok: true,
    deprecatedCount,
    targets: targets.map((a) => ({
      id: a.id,
      name: a.name ?? a.agentName ?? "(이름 없음)",
      lastUsedAt: a.lastUsedAt,
    })),
  });
}

/**
 * GET /api/admin/agents/inactive-check
 * 12개월 미사용 후보 미리보기 (실제 처리하지 않음).
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    const auth = await requireRole("AX_TEAM");
    if ("error" in auth) return auth.error;
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - INACTIVE_MONTHS);

  const candidates = await prisma.agentRegistry.findMany({
    where: {
      phase: "PRODUCTION",
      prodStatus: "ACTIVE",
      OR: [
        { lastUsedAt: { lte: cutoff } },
        { lastUsedAt: null },
      ],
    },
    select: {
      id: true, name: true, agentName: true, lastUsedAt: true,
      prodStatus: true, productionAt: true,
    },
    orderBy: { lastUsedAt: "asc" },
  });

  return NextResponse.json({ cutoff: cutoff.toISOString(), candidates });
}
