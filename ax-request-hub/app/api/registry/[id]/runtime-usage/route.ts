import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * POST /api/registry/[id]/runtime-usage
 * 상용(PRODUCTION) 에이전트의 실행 비용 기록.
 * 외부 시스템(AWS Lambda, 게이트웨이)이 에이전트 호출 완료 후 기록.
 *
 * Body:
 *   ownerEmail   string  — 배포 시 지정된 오너 이메일
 *   providerKey  string  — 호출 모델 API 키 또는 식별자
 *   tokenUsed    number  — 소비 토큰 수
 *   costKrw      number  — 실비용 (원화, 0 불허)
 *   calledAt?    string  — ISO 날짜 (기본: now)
 *
 * GET /api/registry/[id]/runtime-usage
 * 해당 에이전트의 최근 런타임 사용 이력 조회 (AX_TEAM 전용).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  // 외부 시스템(AX_TEAM) 또는 시스템 계정 호출 허용
  const auth = await requireRole("AX_TEAM", "DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "요청 본문 오류" }, { status: 400 });

  const { ownerEmail, providerKey, tokenUsed, costKrw, calledAt } = body;

  if (!ownerEmail || !providerKey || typeof tokenUsed !== "number" || typeof costKrw !== "number") {
    return NextResponse.json(
      { error: "ownerEmail, providerKey, tokenUsed, costKrw는 필수입니다" },
      { status: 400 }
    );
  }
  if (costKrw <= 0) {
    return NextResponse.json({ error: "costKrw는 0보다 커야 합니다" }, { status: 400 });
  }

  const agent = await prisma.agentRegistry.findUnique({
    where: { id: agentId },
    select: { id: true, phase: true, prodStatus: true },
  });
  if (!agent) return NextResponse.json({ error: "에이전트를 찾을 수 없습니다" }, { status: 404 });
  if (agent.phase !== "PRODUCTION") {
    return NextResponse.json(
      { error: "PRODUCTION 단계 에이전트만 런타임 사용 기록 가능합니다" },
      { status: 422 }
    );
  }

  const calledAtDate = calledAt ? new Date(calledAt) : new Date();

  const [usage] = await prisma.$transaction([
    prisma.agentRuntimeUsage.create({
      data: { agentId, ownerEmail, providerKey, tokenUsed, costKrw, calledAt: calledAtDate },
    }),
    // lastUsedAt 갱신 — 12개월 미사용 DEPRECATED 체크 기준
    prisma.agentRegistry.update({
      where: { id: agentId },
      data: { lastUsedAt: calledAtDate },
    }),
  ]);

  return NextResponse.json(usage, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const usages = await prisma.agentRuntimeUsage.findMany({
    where: { agentId },
    orderBy: { calledAt: "desc" },
    take: 100,
  });

  const totalCost = usages.reduce((s, u) => s + u.costKrw, 0);
  const totalTokens = usages.reduce((s, u) => s + u.tokenUsed, 0);

  return NextResponse.json({ agentId, totalCost, totalTokens, count: usages.length, usages });
}
