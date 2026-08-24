import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify, NotifyEvent } from "@/lib/notify";

const WARN_DAYS = 14; // 만료 14일 전 알림

/**
 * POST /api/admin/usage/expire-check
 * 데이터 제공 만료 배치 — 일 1회 실행 (v3 §10-3).
 * 1. expiresAt <= now → EXPIRED 처리 + 연결 PRODUCTION 에이전트 자동 SUSPENDED
 * 2. expiresAt <= now+14d → 만료 임박 알림 (requesterId 기준)
 */
export async function POST() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const now = new Date();
  const warnDate = new Date(now.getTime() + WARN_DAYS * 24 * 60 * 60 * 1000);

  // 1. 만료된 DataProvision 처리
  const expired = await prisma.dataProvision.findMany({
    where: { expiresAt: { lte: now }, revokedAt: null },
    include: { request: { include: { project: true } } },
  });

  let expiredCount = 0;
  let suspendedAgentCount = 0;
  for (const prov of expired) {
    await prisma.$transaction([
      prisma.dataProvision.update({
        where: { id: prov.id },
        data: { revokedAt: now, revokeReason: "이용기간 만료(자동 처리)" },
      }),
      prisma.dataRequest.update({
        where: { id: prov.requestId },
        data: { status: "EXPIRED" },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "DataProvision",
          entityId: prov.id,
          action: "DATA_PROVISION_EXPIRED",
          actorEmail: "SYSTEM",
          detail: JSON.stringify({ expiresAt: prov.expiresAt, requestId: prov.requestId }),
        },
      }),
    ]);
    expiredCount++;

    // PRODUCTION 에이전트 자동 SUSPENDED (v3 §10-4)
    if (prov.request.projectId) {
      const prodAgent = await prisma.agentRegistry.findFirst({
        where: { projectId: prov.request.projectId, phase: "PRODUCTION", prodStatus: "ACTIVE" },
        select: { id: true },
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
            action: "AGENT_AUTO_SUSPENDED_DATA_EXPIRED",
            actorEmail: "SYSTEM",
            detail: JSON.stringify({ provisionId: prov.id }),
          },
        });
        suspendedAgentCount++;
      }
    }
  }

  // 2. 만료 14일 전 임박 알림
  const warningSoon = await prisma.dataProvision.findMany({
    where: { expiresAt: { lte: warnDate, gt: now }, revokedAt: null },
    include: { request: { include: { project: { select: { requesterEmail: true, title: true } } } } },
  });

  const notifiedEmails = new Set<string>();
  for (const prov of warningSoon) {
    const email = prov.request.project?.requesterEmail;
    if (!email || notifiedEmails.has(email)) continue;
    notifiedEmails.add(email);
    const daysLeft = Math.ceil((prov.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const event: NotifyEvent = {
      type: "DATA_REQUEST_UPDATE",
      title: "데이터 이용 기간 만료 임박",
      body: `'${prov.request.project?.title ?? ""}' 과제의 데이터 제공이 ${daysLeft}일 후 만료됩니다. 연장 신청을 검토하세요.`,
      link: "/me/data",
    };
    await notify(event, [email]).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    expiredCount,
    suspendedAgentCount,
    warningSentCount: notifiedEmails.size,
  });
}
