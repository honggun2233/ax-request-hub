import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify } from "@/lib/notify";

/**
 * POST /api/dp/requests/[id]/review
 * 검토 시작 (REQUESTED → REVIEWING) 또는 G3 SEC_REVIEW 전환.
 * v3 §10-2: DataRequest 상태 전이.
 *
 * Body (SEC_REVIEW 시 선택):
 *   secReview         boolean  — true이면 REVIEWING → SEC_REVIEW
 *   secReviewAssigneeEmail  string   — 정보보호 담당자 이메일 (SEC_REVIEW 주체 명시)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { secReview, secReviewAssigneeEmail } = body;

  const dr = await prisma.dataRequest.findUnique({ where: { id } });
  if (!dr) return NextResponse.json({ error: "신청을 찾을 수 없습니다" }, { status: 404 });

  const validFrom = secReview ? ["REVIEWING"] : ["REQUESTED", "PENDING"];
  if (!validFrom.includes(dr.status)) {
    return NextResponse.json(
      { error: `현재 상태(${dr.status})에서는 이 전환을 수행할 수 없습니다` },
      { status: 409 }
    );
  }

  const newStatus = secReview ? "SEC_REVIEW" : "REVIEWING";
  const updated = await prisma.$transaction([
    prisma.dataRequest.update({
      where: { id },
      data: { status: newStatus, reviewerId: (auth as any).user?.id ?? null },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "DataRequest",
        entityId: id,
        action: `DATA_REQUEST_${newStatus}`,
        actorEmail: (auth as any).user.email,
        detail: JSON.stringify({
          prevStatus: dr.status,
          newStatus,
          // §정보보호 SEC_REVIEW 주체 명시
          ...(secReview && secReviewAssigneeEmail
            ? { secReviewAssignee: secReviewAssigneeEmail }
            : {}),
        }),
      },
    }),
  ]);

  // SEC_REVIEW 전환 시 정보보호 담당자에게 검토 요청 알림
  if (secReview && secReviewAssigneeEmail) {
    await notify(
      secReviewAssigneeEmail,
      "[정보보호 검토 요청] 데이터 신청 G3 보안 검토",
      `G3(기밀) 등급 데이터 신청에 대한 정보보호 검토가 필요합니다. 신청 ID: ${id}`,
      `/dp/requests`
    ).catch((e) => console.error("[review] SEC_REVIEW 담당자 알림 실패 (무시):", e));
  }

  return NextResponse.json(updated[0]);
}
