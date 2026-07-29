import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify, NotifyEvent } from "@/lib/notify";
import { displayName } from "@/lib/council-eligibility";

/**
 * 오프라인 협의회 의결 결과 입력 (AX팀 간사).
 * 의결 유형별 후속 처리를 한 트랜잭션으로 수행한다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const { decision, decisionNote, conditions, prodKpiTarget } = await req.json();

  const VALID = ["APPROVED", "CONDITIONAL", "REMANDED", "REJECTED", "DEFERRED"];
  if (!VALID.includes(decision))
    return NextResponse.json({ error: "유효하지 않은 의결 유형입니다" }, { status: 400 });
  if (["REMANDED", "REJECTED"].includes(decision) && !decisionNote)
    return NextResponse.json({ error: "반려 사유(decisionNote)는 필수입니다" }, { status: 400 });
  if (decision === "CONDITIONAL" && (!Array.isArray(conditions) || conditions.length === 0))
    return NextResponse.json({ error: "조건부 승인은 조건 목록이 필요합니다" }, { status: 400 });

  const item = await prisma.councilAgendaItem.findUnique({
    where: { id },
    include: { agent: true },
  });
  if (!item) return NextResponse.json({ error: "안건을 찾을 수 없습니다" }, { status: 404 });
  if (item.decision) return NextResponse.json({ error: "이미 의결된 안건입니다" }, { status: 409 });

  const now = new Date();
  const agentUpdate = (() => {
    if (item.itemType === "PROD_APPROVAL") {
      switch (decision) {
        case "APPROVED":
          return { phase: "PRODUCTION", devStage: null, prodStatus: "ACTIVE",
                   productionAt: now, ...(prodKpiTarget && { prodKpiTarget: JSON.stringify(prodKpiTarget) }) };
        case "CONDITIONAL": return { devStage: "COND_APPROVED" };
        case "REMANDED":    return { devStage: "GATE3" };
        case "REJECTED":    return { phase: "CLOSED", devStage: "DEV_REJECTED" };
        default:            return {}; // DEFERRED — COUNCIL_PENDING 유지
      }
    }
    if (item.itemType === "RETIRE_APPROVAL" && decision === "APPROVED")
      return { prodStatus: "DEPRECATED", retireFlag: false }; // 30일 예고 시작
    return {};
  })();

  await prisma.$transaction([
    prisma.councilAgendaItem.update({
      where: { id: item.id },
      data: {
        decision, decisionNote: decisionNote ?? null,
        conditions: decision === "CONDITIONAL"
          ? JSON.stringify(conditions.map((c: string) => ({ condition: c, done: false, checkedBy: null })))
          : null,
        decidedAt: now,
      },
    }),
    ...(Object.keys(agentUpdate).length
      ? [prisma.agentRegistry.update({ where: { id: item.agentId }, data: agentUpdate })]
      : []),
    prisma.auditLog.create({
      data: {
        entityType: "AgentRegistry",
        entityId: item.agentId,
        action: "COUNCIL_DECISION",
        actorEmail: auth.user.email,
        detail: JSON.stringify({ agendaItemId: item.id, itemType: item.itemType, decision, decisionNote }),
      },
    }),
  ]);

  // 신청자 알림 — Project.requesterEmail 기준. 상용 전환 시 데이터 상용 재승인 안내 (v3 §10-4)
  if (item.agent.projectId) {
    const project = await prisma.project.findUnique({ where: { id: item.agent.projectId } });
    if (project?.requesterEmail) {
      const agentLabel = displayName(item.agent);
      const msg: Record<string, [string, string]> = {
        APPROVED: ["정식 운영 승인", `'${agentLabel}'이(가) 협의회 승인으로 정식 운영으로 전환되었습니다. 데이터 사용 중이라면 상용 재승인 신청이 필요합니다.`],
        CONDITIONAL: ["조건부 승인", `'${agentLabel}'이(가) 조건부 승인되었습니다. 조건 이행 후 정식 운영으로 전환됩니다.`],
        REMANDED: ["심의 반려", `'${agentLabel}' 상정이 반려되었습니다. 사유: ${decisionNote}`],
        REJECTED: ["최종 반려", `'${agentLabel}' 과제가 최종 반려되었습니다. 사유: ${decisionNote}`],
        DEFERRED: ["심의 보류", `'${agentLabel}' 안건이 차기 협의회로 이월되었습니다.`],
      };
      const [title, body] = msg[decision];
      const event: NotifyEvent = { type: 'GATE_TRANSITION', title, body, link: '/me/projects' };
      await notify(event, [project.requesterEmail]);
    }
  }

  return NextResponse.json({ ok: true });
}
