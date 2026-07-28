import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { checkProdEligibility, displayName } from "@/lib/council-eligibility";

/** ?mode=eligible → 상용 전환 상정 가능 후보 (요건 검증 결과 포함) */
export async function GET(req: Request) {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const mode = new URL(req.url).searchParams.get("mode");
  if (mode === "eligible") {
    const candidates = await prisma.agentRegistry.findMany({
      where: {
        phase: "DEVELOPMENT",
        OR: [{ devStage: { in: ["GATE3", "PILOT_PROVEN"] } }, { gate3Passed: true }],
      },
    });
    const results = await Promise.all(
      candidates.map(async (a) => ({
        agent: { id: a.id, name: displayName(a) },
        ...(await checkProdEligibility(a.id)),
      }))
    );
    return NextResponse.json(results);
  }
  const items = await prisma.councilAgendaItem.findMany({
    where: { decision: null },
    include: { agent: true, meeting: true },
  });
  return NextResponse.json(
    items.map((i) => ({ ...i, agent: { ...i.agent, name: displayName(i.agent) } }))
  );
}

/** 안건 상정 — PROD_APPROVAL은 요건 5종 전건 충족 시에만 허용 */
export async function POST(req: Request) {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const { meetingId, agentId, itemType } = await req.json();
  if (!meetingId || !agentId || !itemType)
    return NextResponse.json({ error: "meetingId, agentId, itemType은 필수입니다" }, { status: 400 });

  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) return NextResponse.json({ error: "에이전트를 찾을 수 없습니다" }, { status: 404 });

  let packageMeta: Record<string, unknown> = { snapshotAt: new Date().toISOString(), itemType };

  if (itemType === "PROD_APPROVAL") {
    const { eligible, checks } = await checkProdEligibility(agentId);
    if (!eligible)
      return NextResponse.json({ error: "상정 요건 미충족", checks }, { status: 422 });
    packageMeta = { ...packageMeta, checks, devStage: agent.devStage, trustScore: agent.trustScore ?? agent.operatorTrustScore };
  }

  const [item] = await prisma.$transaction([
    prisma.councilAgendaItem.create({
      data: { meetingId, agentId, itemType, packageMeta: JSON.stringify(packageMeta) },
    }),
    ...(itemType === "PROD_APPROVAL"
      ? [prisma.agentRegistry.update({ where: { id: agentId }, data: { devStage: "COUNCIL_PENDING" } })]
      : []),
    prisma.auditLog.create({
      data: {
        entityType: "AgentRegistry",
        entityId: agentId,
        action: "COUNCIL_AGENDA_CREATED",
        actorEmail: auth.user.email,
        detail: JSON.stringify({ meetingId, itemType }),
      },
    }),
  ]);
  return NextResponse.json(item, { status: 201 });
}
