import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { checkProdEligibility, displayName } from "@/lib/council-eligibility";

/**
 * GET /api/council/agenda/[id]
 * 협의회 심의 패키지 조회 (안건 상세 + 에이전트 스냅샷 + 요건 점검 결과).
 * v3 §8: 안건 조회 시 스냅샷 packageMeta 포함 반환.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const item = await prisma.councilAgendaItem.findUnique({
    where: { id },
    include: {
      meeting: true,
      agent: {
        include: {
          scores: {
            where: { phase: "DEVELOPMENT", month: { not: null } },
            orderBy: { month: "asc" },
          },
          projects: { include: { project: true } },
        },
      },
    },
  });

  if (!item) return NextResponse.json({ error: "안건을 찾을 수 없습니다" }, { status: 404 });

  // 최신 요건 상태 실시간 재계산 (패키지 생성 이후 변경분 반영)
  const { eligible, checks } = await checkProdEligibility(item.agentId);

  // 조건부 승인 조건 JSON 파싱
  let parsedConditions: { condition: string; done: boolean; checkedBy: string | null }[] | null = null;
  if (item.conditions) {
    try { parsedConditions = JSON.parse(item.conditions); } catch { /* ignore */ }
  }

  return NextResponse.json({
    ...item,
    agent: { ...item.agent, name: displayName(item.agent) },
    packageMeta: item.packageMeta ? (() => { try { return JSON.parse(item.packageMeta!); } catch { return null; } })() : null,
    parsedConditions,
    eligibility: { eligible, checks },
  });
}
