import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function GET() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const meetings = await prisma.councilMeeting.findMany({
    orderBy: { meetingNo: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json(meetings);
}

/** 오프라인 회의 등록 (회의 전 안건 편성용, 회의 후 결과 기록용 모두 가능) */
export async function POST(req: Request) {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const { heldAt, notes } = await req.json();
  if (!heldAt) return NextResponse.json({ error: "개최일을 입력하세요" }, { status: 400 });
  const last = await prisma.councilMeeting.findFirst({ orderBy: { meetingNo: "desc" } });
  const meeting = await prisma.councilMeeting.create({
    data: { meetingNo: (last?.meetingNo ?? 0) + 1, heldAt: new Date(heldAt), notes: notes ?? null },
  });
  return NextResponse.json(meeting, { status: 201 });
}
