import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

const UNIT_LABEL: Record<string, string> = { HOURS_YEAR: "시간/년", KRW_10K_YEAR: "만원/년" };

export async function GET() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const prodAgents = await prisma.agentRegistry.findMany({
    where: { phase: "PRODUCTION", projectId: { not: null } },
    select: { projectId: true, prodStatus: true },
  });
  const projectIds = [...new Set(prodAgents.map((a) => a.projectId!))];
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: { benefitRecords: { orderBy: { period: "asc" } } },
  });

  return NextResponse.json(
    projects.map((p) => {
      const realizedTotal = p.benefitRecords.reduce((s, r) => s + r.realizedValue, 0);
      const expected = (p as any).expectedBenefitValue as number | null;
      return {
        id: p.id,
        title: p.title,
        department: p.department,
        expectedValue: expected,
        unit: (p as any).expectedBenefitUnit ?? p.benefitRecords[0]?.unit ?? null,
        unitLabel: UNIT_LABEL[(p as any).expectedBenefitUnit ?? ""] ?? null,
        records: p.benefitRecords.map((r) => ({ period: r.period, value: r.realizedValue, note: r.note })),
        realizedTotal,
        realizedPct: expected ? Math.round((realizedTotal / expected) * 100) : null,
      };
    })
  );
}

export async function POST(req: Request) {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const { projectId, period, realizedValue, unit, note } = await req.json();
  if (!projectId || !period || realizedValue === undefined || !unit)
    return NextResponse.json({ error: "projectId, period, realizedValue, unit은 필수입니다" }, { status: 400 });
  if (!/^\d{4}-Q[1-4]$/.test(period))
    return NextResponse.json({ error: "period는 '2026-Q3' 형식입니다" }, { status: 400 });

  const rec = await prisma.benefitRecord.upsert({
    where: { projectId_period: { projectId, period } },
    update: { realizedValue, unit, note: note ?? "", recordedBy: auth.user.email },
    create: { projectId, period, realizedValue, unit, note: note ?? "", recordedBy: auth.user.email },
  });
  await prisma.auditLog.create({
    data: {
      entityType: "Project", entityId: projectId, action: "BENEFIT_RECORDED",
      actorEmail: auth.user.email, detail: JSON.stringify({ period, realizedValue, unit }),
    },
  });
  return NextResponse.json(rec, { status: 201 });
}
