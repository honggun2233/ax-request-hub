import { prisma } from "@/lib/prisma";

/** 인앱 알림 생성 — Telegram 대체. 수신자는 이메일 기준 (Project.requesterEmail 등과 일치) */
export async function notify(recipientEmail: string, title: string, body: string, link?: string) {
  try {
    await prisma.notification.create({ data: { recipientEmail, title, body, link } });
  } catch (e) {
    console.error("notify failed", e); // 알림 실패가 본 트랜잭션을 막지 않도록 삼킨다
  }
}
