import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify, NotifyEvent } from "@/lib/notify";

/**
 * POST /api/dp/requests/[id]/approve
 * 데이터 신청 승인/반려.
 * - APPROVED: ACCESS 유형은 즉시 PROVISIONED 가능. NEW 유형은 COLLECTING 단계 진입.
 * - REJECTED: rejectReason 필수.
 * - G3 등급은 isEssentialBusiness 선결 확인 (v3 §10-1).
 * v3 §10-2: DataRequest 상태 전이.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { decision, rejectReason } = body; // decision: "APPROVED" | "REJECTED"

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    return NextResponse.json({ error: "decision은 APPROVED 또는 REJECTED여야 합니다" }, { status: 400 });
  }
  if (decision === "REJECTED" && !rejectReason?.trim()) {
    return NextResponse.json({ error: "반려 사유(rejectReason)는 필수입니다" }, { status: 400 });
  }

  const dr = await prisma.dataRequest.findUnique({
    where: { id },
    include: { project: { select: { requesterEmail: true, title: true, isEssentialBusiness: true } } },
  });
  if (!dr) return NextResponse.json({ error: "신청을 찾을 수 없습니다" }, { status: 404 });

  if (!["REVIEWING", "SEC_REVIEW"].includes(dr.status)) {
    return NextResponse.json(
      { error: `현재 상태(${dr.status})에서는 승인/반려할 수 없습니다` },
      { status: 409 }
    );
  }

  // G3 데이터 승인 선결조건 (v3 §10-1)
  if (decision === "APPROVED" && dr.classification === "G3") {
    if (!(dr.project as any)?.isEssentialBusiness) {
      return NextResponse.json(
        { error: 'G3(기밀) 데이터 승인을 위해서는 과제가 "본질적 업무"로 지정되어야 합니다' },
        { status: 422 }
      );
    }
  }

  // NEW 유형 승인 → COLLECTING, ACCESS 유형 → APPROVED (제공 실행으로 PROVISIONED)
  const nextStatus = decision === "REJECTED"
    ? "REJECTED"
    : dr.type === "NEW" ? "COLLECTING" : "APPROVED";

  await prisma.$transaction([
    prisma.dataRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewerId: (auth as any).user?.id ?? null,
        ...(decision === "REJECTED" ? { rejectReason: rejectReason.trim() } : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "DataRequest",
        entityId: id,
        action: `DATA_REQUEST_${decision}`,
        actorEmail: (auth as any).user.email,
        detail: JSON.stringify({ decision, rejectReason: rejectReason ?? null, nextStatus }),
      },
    }),
  ]);

  // 신청자 알림
  const email = dr.project?.requesterEmail;
  if (email) {
    const event: NotifyEvent = {
      type: "DATA_REQUEST_UPDATE",
      title: decision === "APPROVED" ? "데이터 신청 승인" : "데이터 신청 반려",
      body: decision === "APPROVED"
        ? `'${dr.project?.title ?? ""}' 과제의 데이터 신청이 승인되었습니다.`
        : `'${dr.project?.title ?? ""}' 과제의 데이터 신청이 반려되었습니다. 사유: ${rejectReason}`,
      link: "/me/data",
    };
    await notify(event, [email]).catch(() => {});
  }

  return NextResponse.json({ ok: true, nextStatus });
}
