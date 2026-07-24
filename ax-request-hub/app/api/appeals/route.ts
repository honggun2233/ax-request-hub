import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/** AX팀 — 처리 대기 이의제기 전체 목록 (과제 제목 포함) */
export async function GET() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const appeals = await prisma.projectAppeal.findMany({
    where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
    orderBy: { createdAt: "asc" },
  });
  const projects = await prisma.project.findMany({
    where: { id: { in: appeals.map((a: { projectId: string }) => a.projectId) } },
    select: { id: true, title: true },
  });
  const titleMap = Object.fromEntries(projects.map((p: { id: string; title: string }) => [p.id, p.title]));
  return NextResponse.json(appeals.map((a: typeof appeals[number]) => ({ ...a, projectTitle: titleMap[a.projectId] })));
}
