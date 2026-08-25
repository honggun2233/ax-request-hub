import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * GET /api/admin/audit
 * 감사로그 조회 — AX팀 전용 (전자금융감독규정 §감사기록 보존)
 *
 * QueryParams:
 *   entityType  — DataRequest | AgentRegistry | Employee | Project | ...
 *   entityId    — 특정 엔티티 ID 필터
 *   action      — 부분 일치 (예: DATA_REQUEST, LEVEL_AUTO)
 *   actorEmail  — 부분 일치
 *   from        — ISO 날짜 (createdAt ≥)
 *   to          — ISO 날짜 (createdAt ≤)
 *   page        — 1부터 (기본 1)
 *   limit       — 최대 200 (기본 50)
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const sp = new URL(req.url).searchParams;
  const entityType = sp.get("entityType") ?? undefined;
  const entityId   = sp.get("entityId")   ?? undefined;
  const action     = sp.get("action")     ?? undefined;
  const actorEmail = sp.get("actorEmail") ?? undefined;
  const from       = sp.get("from")       ?? undefined;
  const to         = sp.get("to")         ?? undefined;
  const page  = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") ?? "50", 10)));
  const skip  = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (entityId)   where.entityId   = entityId;
  if (action)     where.action     = { contains: action };
  if (actorEmail) where.actorEmail = { contains: actorEmail };
  if (from || to) {
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to)   dateFilter.lte = new Date(to);
    where.createdAt = dateFilter;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    logs,
  });
}
