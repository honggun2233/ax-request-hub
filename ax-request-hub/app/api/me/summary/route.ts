import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { friendlyAgentStatus, PROJECT_STATUS_LABELS, DATA_REQUEST_LABELS } from "@/lib/lifecycle-labels";

/** 내 정보 대시보드 요약 — 페이지가 필요한 모든 것을 1회 호출로 반환 */
export async function GET() {
  const auth = await requireRole();
  if ("error" in auth) return auth.error;
  const me = auth.user;
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7); // "2026-07"
  const soon = new Date(now.getTime() + 14 * 24 * 3600 * 1000);

  const emp = await prisma.employee.findUnique({ where: { id: me.id } });
  const currentLevel = emp?.currentLevel ?? "L0";

  const [pendingLevelApp, myProjects, myDataRequests, myTools, myUsage, tokenPolicies, requiredCourses, myEnrollments] =
    await Promise.all([
      prisma.levelApplication.findFirst({
        where: { employeeId: me.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.project.findMany({
        where: { requesterEmail: me.email },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.dataRequest.findMany({
        // requesterId = employee.id (data/requests/route.ts:59 기준)
        where: { requesterId: me.id },
        include: { provision: true, asset: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.toolAccount.findMany({
        where: { employeeId: me.id, status: { in: ["ACTIVE", "APPROVED"] } },
      }),
      prisma.usageRecord.findMany({ where: { employeeId: me.id, yearMonth } }),
      prisma.tokenPolicy.findMany({
        where: {
          isActive: true,
          OR: [
            { scope: "EMPLOYEE", employeeId: me.id },
            { scope: "LEVEL", level: currentLevel },
          ],
        },
      }),
      prisma.literacyCourse.findMany({ where: { isRequired: true, isActive: true } }),
      prisma.literacyEnrollment.findMany({ where: { employeeId: me.id } }),
    ]);

  // ── 과제: 에이전트 단계까지 반영한 친화 상태 ──
  const projectIds = myProjects.map((p) => p.id);
  const myAgents = projectIds.length
    ? await prisma.agentRegistry.findMany({ where: { projectId: { in: projectIds } } })
    : [];
  const agentByProject = Object.fromEntries(myAgents.filter((a) => a.projectId).map((a) => [a.projectId!, a]));
  const projects = myProjects.map((p) => {
    const a = agentByProject[p.id];
    const info = a
      ? friendlyAgentStatus(a.phase, a.devStage, a.prodStatus)
      : PROJECT_STATUS_LABELS[p.status] ?? { label: p.status, step: 0, tone: "default" as const };
    return { id: p.id, title: p.title, label: info.label, tone: info.tone, step: info.step };
  });
  const activeProjects = projects.filter((p) => !["반려됨", "운영 종료", "종료"].includes(p.label));

  // ── 데이터: 제공 중 / 만료 임박 / 검토 중 ──
  const provisioned = myDataRequests.filter(
    (r) => r.status === "PROVISIONED" && r.provision && !r.provision.revokedAt
  );
  const expiringSoon = provisioned.filter((r) => r.provision!.expiresAt <= soon);
  const inReview = myDataRequests.filter((r) =>
    ["REQUESTED", "REVIEWING", "SEC_REVIEW", "APPROVED", "COLLECTING"].includes(r.status)
  );

  // ── 도구·사용량 ──
  const TOOL_LABEL: Record<string, string> = { GPT_CHAT: "GPT Chat", GPT_EXCEL: "GPT Excel", GEMINI: "Gemini" };
  const tools = [...new Set(myTools.map((t) => TOOL_LABEL[t.toolType] ?? t.toolType))];
  const tokenUsed = myUsage.reduce((s, u) => s + u.tokenUsed, 0);
  const monthlyLimit = tokenPolicies.reduce((s, p) => s + p.monthlyLimit, 0) || null;
  const usagePct = monthlyLimit ? Math.min(100, Math.round((tokenUsed / monthlyLimit) * 100)) : null;

  // ── 교육 ──
  const doneCourseIds = new Set(myEnrollments.filter((e) => e.status === "COMPLETED").map((e) => e.courseId));
  const requiredDone = requiredCourses.filter((c) => doneCourseIds.has(c.id)).length;
  const nextCourse = requiredCourses.find((c) => !doneCourseIds.has(c.id));

  // ── 조건부 승인 미이행 조건 (내 에이전트) ──
  const condItems = myAgents.length
    ? await prisma.councilAgendaItem.findMany({
        where: { agentId: { in: myAgents.map((a) => a.id) }, decision: "CONDITIONAL", conditions: { not: null } },
      })
    : [];
  const openConditions = condItems.flatMap((i) => {
    try {
      return (JSON.parse(i.conditions!) as { condition: string; done: boolean }[]).filter((c) => !c.done);
    } catch {
      return [];
    }
  });

  // ── 다음 할 일 (파생 규칙 — 없으면 빈 배열 → 페이지에서 섹션 숨김) ──
  const todos: { text: string; link: string; tone: "warning" | "accent" }[] = [];
  for (const r of expiringSoon.slice(0, 2)) {
    const d = Math.max(0, Math.ceil((r.provision!.expiresAt.getTime() - now.getTime()) / 86400000));
    todos.push({ text: `'${r.asset?.name ?? "데이터"}' 이용기간이 ${d}일 후 만료 — 연장 신청`, link: "/me/data", tone: "warning" });
  }
  for (const c of openConditions.slice(0, 2))
    todos.push({ text: `조건부 승인 조건 이행 필요 — ${c.condition}`, link: "/me/projects", tone: "accent" });
  if (nextCourse)
    todos.push({ text: `필수 교육 '${nextCourse.title}' 미이수`, link: "/me/literacy", tone: "accent" });

  return NextResponse.json({
    profile: { name: me.name, department: emp?.department ?? me.department, jobTitle: emp?.jobTitle ?? "" },
    level: { current: currentLevel, pendingApplication: pendingLevelApp?.requestedLevel ?? null },
    todos: todos.slice(0, 3),
    projects: { activeCount: activeProjects.length, recent: activeProjects.slice(0, 2) },
    data: {
      provisionedCount: provisioned.length,
      expiringSoonCount: expiringSoon.length,
      inReviewCount: inReview.length,
      inReviewLabel: inReview[0] ? DATA_REQUEST_LABELS[inReview[0].status] ?? inReview[0].status : null,
    },
    tools: { names: tools, tokenUsed, monthlyLimit, usagePct },
    literacy: { requiredDone, requiredTotal: requiredCourses.length, nextCourse: nextCourse?.title ?? null },
  });
}
