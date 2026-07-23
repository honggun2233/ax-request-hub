import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const meeting = await prisma.councilMeeting.findUnique({
    where: { id: params.id },
    include: { items: { include: { agent: true }, orderBy: { id: "asc" } } },
  });
  if (!meeting) return NextResponse.json({ error: "회의를 찾을 수 없습니다" }, { status: 404 });
  return NextResponse.json(meeting);
}

/** 회의 요록·개최일 수정 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const { heldAt, notes } = await req.json();
  const meeting = await prisma.councilMeeting.update({
    where: { id: params.id },
    data: { ...(heldAt && { heldAt: new Date(heldAt) }), ...(notes !== undefined && { notes }) },
  });
  return NextResponse.json(meeting);
}
