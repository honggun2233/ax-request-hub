import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify, NotifyEvent } from "@/lib/notify";

/**
 * POST /api/dp/requests/[id]/provision
 * 데이터 제공 실행 — DataProvision 생성 + DataRequest status → PROVISIONED.
 * connectionRef는 시크릿 저장소 키만 저장 (원문 저장 금지, v3 §10-3).
 * v3 §10-2: APPROVED/COLLECTING → PROVISIONED.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { deliveryMode, connectionRef, expiresAt } = body;

  if (!deliveryMode || !connectionRef?.trim() || !expiresAt) {
    return NextResponse.json(
      { error: "deliveryMode, connectionRef(시크릿 키), expiresAt은 필수입니다" },
      { status: 400 }
    );
  }

  const VALID_MODES = ["API", "FILE", "DB"];
  if (!VALID_MODES.includes(deliveryMode)) {
    return NextResponse.json(
      { error: `deliveryMode는 ${VALID_MODES.join(" | ")} 중 하나여야 합니다` },
      { status: 400 }
    );
  }

  // connectionRef 형식 검증 — 인가된 시크릿/연결 스키마만 허용
  const VALID_REF_PATTERN = /^(vault:\/\/|s3:\/\/|gcs:\/\/|jdbc:|https?:\/\/|sftp:\/\/|db:\/\/|az:\/\/)/;
  if (!VALID_REF_PATTERN.test(connectionRef.trim())) {
    return NextResponse.json(
      {
        error:
          "connectionRef 형식이 올바르지 않습니다. 허용 스키마: vault://, s3://, gcs://, jdbc:, http(s)://, sftp://, db://, az://",
      },
      { status: 400 }
    );
  }

  const dr = await prisma.dataRequest.findUnique({
    where: { id },
    include: { project: { select: { requesterEmail: true, title: true } }, provision: true },
  });
  if (!dr) return NextResponse.json({ error: "신청을 찾을 수 없습니다" }, { status: 404 });

  if (!["APPROVED", "COLLECTING"].includes(dr.status)) {
    return NextResponse.json(
      { error: `현재 상태(${dr.status})에서는 제공 실행을 할 수 없습니다. APPROVED 또는 COLLECTING 상태여야 합니다` },
      { status: 409 }
    );
  }
  if (dr.provision) {
    return NextResponse.json({ error: "이미 제공이 완료된 신청입니다" }, { status: 409 });
  }

  const expDate = new Date(expiresAt);
  if (isNaN(expDate.getTime()) || expDate <= new Date()) {
    return NextResponse.json({ error: "expiresAt은 미래 날짜여야 합니다" }, { status: 400 });
  }

  const [provision] = await prisma.$transaction([
    prisma.dataProvision.create({
      data: {
        requestId: id,
        deliveryMode,
        connectionRef: connectionRef.trim(),
        expiresAt: expDate,
      },
    }),
    prisma.dataRequest.update({
      where: { id },
      data: { status: "PROVISIONED", reviewerId: (auth as any).user?.id ?? null },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "DataRequest",
        entityId: id,
        action: "DATA_REQUEST_PROVISIONED",
        actorEmail: (auth as any).user.email,
        detail: JSON.stringify({ deliveryMode, expiresAt }),
      },
    }),
  ]);

  // 신청자 알림
  const email = dr.project?.requesterEmail;
  if (email) {
    const event: NotifyEvent = {
      type: "DATA_REQUEST_UPDATE",
      title: "데이터 제공 완료",
      body: `'${dr.project?.title ?? ""}' 과제의 데이터가 제공되었습니다. 이용 기한: ${expDate.toLocaleDateString("ko-KR")}`,
      link: "/me/data",
    };
    await notify(event, [email]).catch(() => {});
  }

  return NextResponse.json(provision, { status: 201 });
}
