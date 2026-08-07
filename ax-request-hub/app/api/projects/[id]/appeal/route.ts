import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify } from "@/lib/notify";

/** 본인(requesterEmail 일치) 또는 AX팀 조회 가능 — 기존 ADMIN 전용에서 개정 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole();
  if ("error" in auth) return auth.error;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 });
  const isOwner = project.requesterEmail === auth.user.email;
  if (!isOwner && auth.user.role !== "AX_TEAM")
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
  const appeals = await prisma.projectAppeal.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(appeals);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole();
  if ("error" in auth) return auth.error;
  const { reason, evidenceNote } = await req.json();
  if (!reason?.trim()) return NextResponse.json({ error: "이의제기 사유를 입력하세요" }, { status: 400 });
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "과제를 찾을 수 없습니다" }, { status: 404 });
  if (project.requesterEmail !== auth.user.email)
    return NextResponse.json({ error: "본인 과제만 이의제기할 수 있습니다" }, { status: 403 });
  const APPEAL_LIMIT = 3;
  const totalAppeals = await prisma.projectAppeal.count({ where: { projectId: id } });
  if (totalAppeals >= APPEAL_LIMIT)
    return NextResponse.json({ error: `이의제기는 최대 ${APPEAL_LIMIT}회까지 가능합니다` }, { status: 422 });
  const pending = await prisma.projectAppeal.findFirst({
    where: { projectId: id, status: { in: ["PENDING", "UNDER_REVIEW"] } },
  });
  if (pending) return NextResponse.json({ error: "이미 진행 중인 이의제기가 있습니다" }, { status: 409 });
  const appeal = await prisma.projectAppeal.create({
    data: {
      projectId: id,
      requesterEmail: auth.user.email,
      reason,
      evidenceNote: evidenceNote ?? "",
    },
  });
  return NextResponse.json(appeal, { status: 201 });
}

/** AX팀 처리 — result: ACCEPTED | REJECTED. 결과는 신청자에게 알림 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const { appealId, result, reviewNote } = await req.json();
  if (!["ACCEPTED", "REJECTED"].includes(result))
    return NextResponse.json({ error: "result는 ACCEPTED 또는 REJECTED여야 합니다" }, { status: 400 });
  const appeal = await prisma.projectAppeal.update({
    where: { id: appealId },
    data: {
      status: result,
      reviewNote: reviewNote ?? "",
      reviewedBy: auth.user.email,
      resolvedAt: new Date(),
    },
  });
  await prisma.auditLog.create({
    data: {
      entityType: "Project",
      entityId: id,
      action: "APPEAL_RESOLVED",
      actorEmail: auth.user.email,
      detail: JSON.stringify({ appealId, result, reviewNote }),
    },
  });
  if (result === "ACCEPTED") {
    await prisma.project.update({
      where: { id },
      data: { status: "evaluated" },
    });
  }
  await notify(
    appeal.requesterEmail,
    result === "ACCEPTED" ? "이의제기 수용" : "이의제기 기각",
    reviewNote || "처리 결과를 확인하세요.",
    "/me/projects"
  );
  return NextResponse.json(appeal);
}
