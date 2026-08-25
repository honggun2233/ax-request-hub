import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { isCronAuthorized } from "@/lib/cron";

const RETIRE_GRACE_DAYS = 30;

/**
 * POST /api/admin/agents/retire-check
 * DEPRECATED 상태 에이전트의 30일 예고 기간 만료 시 자동 RETIRED 전환.
 *
 * 기준: COUNCIL_DECISION(RETIRE_APPROVAL APPROVED) 또는 AGENT_AUTO_DEPRECATED_INACTIVE AuditLog
 *       createdAt 기준으로 RETIRE_GRACE_DAYS일 경과한 경우.
 *
 * 배치 주기: 일 1회 권장.
 *
 * GET: 미리보기 (실제 처리 없음).
 */
export async function POST(req: NextRequest) {
  // CRON_SECRET 인증 또는 AX_TEAM 세션 인증
  let actorEmail = "SYSTEM";
  if (!isCronAuthorized(req)) {
    const auth = await requireRole("AX_TEAM");
    if ("error" in auth) return auth.error;
    actorEmail = auth.user.email;
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - RETIRE_GRACE_DAYS * 24 * 60 * 60 * 1000);

  // DEPRECATED 상태 PRODUCTION 에이전트 조회
  const candidates = await prisma.agentRegistry.findMany({
    where: { phase: "PRODUCTION", prodStatus: "DEPRECATED", retiredAt: null },
    select: { id: true, agentName: true, projectId: true },
  });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, retiredCount: 0, message: "30일 예고 만료 대상 없음" });
  }

  const retiredIds: string[] = [];

  for (const agent of candidates) {
    // AuditLog에서 DEPRECATED 전환 시점 확인
    const deprecateLog = await prisma.auditLog.findFirst({
      where: {
        entityType: "AgentRegistry",
        entityId: agent.id,
        action: { in: ["COUNCIL_DECISION", "AGENT_AUTO_DEPRECATED_INACTIVE"] },
      },
      orderBy: { createdAt: "desc" },
    });

    // DEPRECATED 시점이 cutoff 이전이어야 RETIRED 가능
    const deprecatedAt = deprecateLog?.createdAt ?? null;
    if (!deprecatedAt || deprecatedAt > cutoff) continue;

    // RETIRED 전환 + 연결 DataProvision 전건 회수 + AuditLog
    const revokeNow = now;

    const provisions = await prisma.dataProvision.findMany({
      where: {
        request: { projectId: agent.projectId ?? undefined },
        revokedAt: null,
      },
      select: { id: true },
    });
    const provisionIds = provisions.map((p) => p.id);

    await prisma.$transaction([
      prisma.agentRegistry.update({
        where: { id: agent.id },
        data: { prodStatus: "RETIRED", phase: "CLOSED", retiredAt: revokeNow },
      }),
      ...(provisionIds.length > 0
        ? [
            prisma.dataProvision.updateMany({
              where: { id: { in: provisionIds } },
              data: { revokedAt: revokeNow, revokeReason: `에이전트 폐기 30일 예고 만료(자동): ${agent.agentName}` },
            }),
          ]
        : []),
      prisma.auditLog.create({
        data: {
          entityType: "AgentRegistry",
          entityId: agent.id,
          action: "AGENT_AUTO_RETIRED_AFTER_GRACE",
          actorEmail,
          detail: JSON.stringify({
            deprecatedAt: deprecatedAt?.toISOString(),
            graceDays: RETIRE_GRACE_DAYS,
            revokedProvisions: provisionIds.length,
            triggeredBy: actorEmail,
          }),
        },
      }),
    ]);

    retiredIds.push(agent.id);
  }

  return NextResponse.json({
    ok: true,
    retiredCount: retiredIds.length,
    retiredIds,
    checkedCount: candidates.length,
  });
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    const auth = await requireRole("AX_TEAM");
    if ("error" in auth) return auth.error;
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - RETIRE_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.agentRegistry.findMany({
    where: { phase: "PRODUCTION", prodStatus: "DEPRECATED", retiredAt: null },
    select: { id: true, agentName: true, updatedAt: true },
  });

  const preview = await Promise.all(
    candidates.map(async (a) => {
      const log = await prisma.auditLog.findFirst({
        where: {
          entityType: "AgentRegistry",
          entityId: a.id,
          action: { in: ["COUNCIL_DECISION", "AGENT_AUTO_DEPRECATED_INACTIVE"] },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, action: true },
      });
      const deprecatedAt = log?.createdAt ?? null;
      const graceDaysLeft = deprecatedAt
        ? RETIRE_GRACE_DAYS - Math.floor((now.getTime() - deprecatedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: a.id,
        agentName: a.agentName,
        deprecatedAt,
        graceDaysLeft,
        willRetire: deprecatedAt ? deprecatedAt <= cutoff : false,
      };
    })
  );

  return NextResponse.json({ candidateCount: candidates.length, graceDays: RETIRE_GRACE_DAYS, preview });
}
