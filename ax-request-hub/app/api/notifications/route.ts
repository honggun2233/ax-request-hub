import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function GET() {
  const auth = await requireRole();
  if ("error" in auth) return auth.error;
  const items = await prisma.notification.findMany({
    where: { recipientEmail: auth.user.email },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const unread = items.filter((n) => !n.readAt).length;
  return NextResponse.json({ items, unread });
}

/** body 없이 호출 시 전체 읽음, { id } 전달 시 단건 읽음 */
export async function PATCH(req: Request) {
  const auth = await requireRole();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  await prisma.notification.updateMany({
    where: { recipientEmail: auth.user.email, readAt: null, ...(body.id && { id: body.id }) },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
