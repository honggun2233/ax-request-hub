import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function GET() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const soon = new Date(now.getTime() + 14 * 24 * 3600 * 1000);

  const [
    evaluationWaiting, conditionalItems, dataWaiting,
    appealsPending, levelPending, toolPending,
    draftDocs, g3ThisMonth,
    activeProjects,
    activeToolAccounts, quotas, l2Plus,
    stageRows,
    productionActive, expiringProvisions,
  ] = await Promise.all([
    prisma.project.count({ where: { status: "evaluated" } }),
    prisma.councilAgendaItem.findMany({ where: { decision: "CONDITIONAL", conditions: { not: null } } }),
    prisma.dataRequest.count({ where: { status: { in: ["REQUESTED", "REVIEWING", "SEC_REVIEW"] } } }),
    prisma.projectAppeal.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW"] } } }),
    prisma.levelApplication.count({ where: { status: "PENDING" } }),
    prisma.toolAccount.count({ where: { status: "PENDING" } }),
    prisma.governanceDoc.count({ where: { status: "draft" } }),
    prisma.project.count({ where: { confidentialityLevel: "G3", createdAt: { gte: monthStart } } }),
    prisma.project.findMany({
      where: { status: { in: ["approved", "pilot"] } },
      select: { department: true },
    }),
    prisma.toolAccount.count({ where: { status: "ACTIVE" } }),
    prisma.departmentQuota.findMany({ select: { totalQuota: true } }),
    prisma.employee.count({ where: { isActive: true, currentLevel: { in: ["L2", "L3", "L4"] } } }),
    prisma.agentRegistry.groupBy({ by: ["devStage"], where: { phase: "DEVELOPMENT" }, _count: true }),
    prisma.agentRegistry.count({ where: { phase: "PRODUCTION", prodStatus: "ACTIVE" } }),
    prisma.dataProvision.findMany({
      where: { revokedAt: null, expiresAt: { lte: soon, gte: now } },
      include: { request: { include: { asset: { select: { name: true } } } } },
    }),
  ]);

  const councilConditions = conditionalItems.filter((i: { conditions: string | null }) => {
    try { return (JSON.parse(i.conditions!) as { done: boolean }[]).some((c: { done: boolean }) => !c.done); }
    catch { return false; }
  }).length;

  const stageCount = (s: string) => stageRows.find((r: { devStage: string | null; _count: number }) => r.devStage === s)?._count ?? 0;

  let benefitRealizedPct: number | null = null;
  try {
    const anyPrisma = prisma as any;
    if (anyPrisma.benefitRecord) {
      const recs: { realizedValue: number; projectId: string }[] = await anyPrisma.benefitRecord.findMany({ select: { realizedValue: true, projectId: true } });
      const projs = await prisma.project.findMany({
        where: { id: { in: recs.map((r) => r.projectId) } },
        select: { id: true, expectedBenefitValue: true } as any,
      }) as unknown as { id: string; expectedBenefitValue?: number | null }[];
      const expected = projs.reduce((s: number, p: { expectedBenefitValue?: number | null }) => s + (p.expectedBenefitValue ?? 0), 0);
      const realized = recs.reduce((s: number, r: { realizedValue: number }) => s + r.realizedValue, 0);
      benefitRealizedPct = expected > 0 ? Math.round((realized / expected) * 100) : null;
    }
  } catch { /* BenefitRecord 미도입 — 정상 */ }

  const exceptions = expiringProvisions.map((p: typeof expiringProvisions[number]) => {
    const d = Math.max(0, Math.ceil((p.expiresAt.getTime() - now.getTime()) / 86400000));
    return {
      text: `데이터 제공 만료 임박 — '${p.request.asset?.name ?? "자산"}' ${d}일 남음`,
      link: "/dp/requests",
    };
  });

  return NextResponse.json({
    queue: {
      evaluation: evaluationWaiting,
      councilConditions,
      dataRequests: dataWaiting,
      misc: {
        total: appealsPending + levelPending + toolPending,
        appeals: appealsPending, levelApps: levelPending, tools: toolPending,
      },
    },
    cards: {
      governance: { draftDocs, g3ThisMonth },
      pi: {
        activeDepartments: new Set(activeProjects.map((p: { department: string }) => p.department)).size,
        activeProjects: activeProjects.length,
        benefitRealizedPct,
      },
      adoption: {
        activeToolAccounts,
        totalQuota: quotas.reduce((s: number, q: { totalQuota: number }) => s + q.totalQuota, 0),
        l2Plus,
      },
      pilot: {
        gate1: stageCount("GATE1"),
        gate2: stageCount("GATE2"),
        gate3: stageCount("GATE3") + stageCount("PILOT_PROVEN"),
        council: stageCount("COUNCIL_PENDING") + stageCount("COND_APPROVED"),
      },
      resource: { productionActive },
    },
    exceptions,
  });
}
