import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/** 조건 이행 체크 — 전건 이행 시 상용 전환 (재상정 불필요, v3 §8-2) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const { index, done } = await req.json();

  const item = await prisma.councilAgendaItem.findUnique({ where: { id } });
  if (!item || item.decision !== "CONDITIONAL" || !item.conditions)
    return NextResponse.json({ error: "조건부 승인 안건이 아닙니다" }, { status: 400 });

  const conds: { condition: string; done: boolean; checkedBy: string | null }[] = JSON.parse(item.conditions);
  if (index < 0 || index >= conds.length)
    return NextResponse.json({ error: "잘못된 조건 인덱스입니다" }, { status: 400 });
  conds[index] = { ...conds[index], done: Boolean(done), checkedBy: done ? auth.user.email : null };
  const allDone = conds.every((c) => c.done);

  const agent = await prisma.agentRegistry.findUnique({ where: { id: item.agentId }, select: { projectId: true } });

  await prisma.$transaction([
    prisma.councilAgendaItem.update({ where: { id: item.id }, data: { conditions: JSON.stringify(conds) } }),
    ...(allDone
      ? [
          prisma.agentRegistry.update({
            where: { id: item.agentId },
            data: { phase: "PRODUCTION", devStage: null, prodStatus: "ACTIVE", productionAt: new Date() },
          }),
          ...(agent?.projectId
            ? [prisma.project.update({ where: { id: agent.projectId }, data: { status: "production" } })]
            : []),
          prisma.auditLog.create({
            data: {
              entityType: "AgentRegistry",
              entityId: item.agentId,
              action: "COUNCIL_CONDITIONS_FULFILLED",
              actorEmail: auth.user.email,
              detail: JSON.stringify({ agendaItemId: item.id }),
            },
          }),
        ]
      : []),
  ]);
  return NextResponse.json({ ok: true, allDone });
}
