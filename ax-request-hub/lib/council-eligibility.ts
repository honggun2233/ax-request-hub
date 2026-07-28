import { prisma } from "@/lib/prisma";

export type EligibilityCheck = { key: string; label: string; passed: boolean; detail?: string };

/** 상용 전환(PROD_APPROVAL) 상정 요건 5종 검증 — architecture v3 §8-1 */
export async function checkProdEligibility(agentId: string): Promise<{ eligible: boolean; checks: EligibilityCheck[] }> {
  const agent = await prisma.agentRegistry.findUnique({
    where: { id: agentId },
    include: { scores: { where: { phase: "DEVELOPMENT", month: { not: null } } } },
  });
  if (!agent) return { eligible: false, checks: [{ key: "exists", label: "에이전트 존재", passed: false }] };

  const gateOk = ["GATE3", "PILOT_PROVEN"].includes(agent.devStage ?? "") || agent.gate3Passed;
  const kpiOk = agent.scores.length >= 1;

  // projectId는 이관 전 레거시 행에서 null일 수 있다 — 미연결이면 상정 불가
  const projectLinked = Boolean(agent.projectId);
  const dataRequests = projectLinked
    ? await prisma.dataRequest.findMany({ where: { projectId: agent.projectId! } })
    : [];
  const dataOk =
    projectLinked &&
    (dataRequests.length === 0 ||
      (dataRequests.every((r) => r.status === "PROVISIONED") &&
        !dataRequests.some((r) => ["EXPIRED", "REVOKED"].includes(r.status))));

  const project = projectLinked
    ? await prisma.project.findUnique({ where: { id: agent.projectId! } })
    : null;
  const gate2Ok = Boolean(project?.techStandardsPassed);
  const planOk = Boolean(agent.prodKpiTarget);

  const checks: EligibilityCheck[] = [
    { key: "gate3", label: "Gate 3 통과", passed: gateOk, detail: agent.devStage ?? agent.lifecycleStage },
    { key: "kpi", label: "파일럿 KPI 실적 1개월 이상", passed: kpiOk, detail: `${agent.scores.length}건` },
    { key: "data", label: "과제 연결 + 데이터 제공 정상", passed: dataOk, detail: projectLinked ? `데이터 신청 ${dataRequests.length}건` : "과제 미연결" },
    { key: "gate2", label: "기밀등급 처리 이행 (Gate 2)", passed: gate2Ok },
    { key: "plan", label: "상용 운영 계획(KPI 목표) 등록", passed: planOk },
  ];
  return { eligible: checks.every((c) => c.passed), checks };
}

/** UI 표시명 — v3 name이 있으면 우선, 없으면 레거시 agentName */
export function displayName(agent: { name?: string | null; agentName?: string | null }) {
  return agent.name ?? agent.agentName ?? "(이름 없음)";
}
