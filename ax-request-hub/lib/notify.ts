import { prisma } from "@/lib/prisma"

// ── 이벤트 타입 ───────────────────────────────────────────
export type NotifyEventType =
  | 'TASK_ESCALATED'
  | 'GATE_TRANSITION'
  | 'DATA_REQUEST_UPDATE'
  | 'TOKEN_WARNING'
  | 'TOKEN_EXCEEDED'
  | 'COUNCIL_READY'
  | 'AGENT_SUSPENDED'

export interface NotifyEvent {
  type: NotifyEventType
  title: string
  body: string
  link?: string
  metadata?: Record<string, unknown>
}

// ── Knox 전송 ─────────────────────────────────────────────
async function sendKnoxNotification(event: NotifyEvent, recipients: string[]): Promise<void> {
  const endpoint = process.env.KNOX_API_ENDPOINT
  const apiKey = process.env.KNOX_API_KEY
  const senderId = process.env.KNOX_SENDER_ID

  if (!endpoint || !apiKey) {
    console.warn('[notify] KNOX_API_ENDPOINT 또는 KNOX_API_KEY 미설정 — Knox 전송 스킵')
    return
  }

  try {
    const res = await fetch(`${endpoint}/notify/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Sender-Id': senderId ?? 'ax-hub',
      },
      body: JSON.stringify({
        recipients,
        eventType: event.type,
        subject: event.title,
        message: event.body,
        link: event.link,
        metadata: event.metadata,
      }),
    })

    if (!res.ok) {
      console.error(`[notify] Knox API 응답 오류: ${res.status} ${res.statusText}`)
    }
  } catch (e) {
    console.error('[notify] Knox fetch 실패', e)
  }
}

// ── 인앱 알림 (DB) ────────────────────────────────────────
async function saveInAppNotification(
  recipientEmail: string,
  title: string,
  body: string,
  link?: string,
): Promise<void> {
  try {
    await prisma.notification.create({ data: { recipientEmail, title, body, link } })
  } catch (e) {
    console.error('[notify] DB 저장 실패', e)
  }
}

// ── 메인 notify 함수 (하위 호환 + Knox) ──────────────────
// 오버로드 1: 이벤트 기반 (Knox + 인앱)
export async function notify(event: NotifyEvent, recipients: string[]): Promise<void>
// 오버로드 2: 기존 시그니처 (하위 호환 — 인앱 전용)
export async function notify(recipientEmail: string, title: string, body: string, link?: string): Promise<void>
// 구현 시그니처
export async function notify(
  eventOrEmail: NotifyEvent | string,
  recipientsOrTitle: string[] | string,
  body?: string,
  link?: string,
): Promise<void> {
  // 이벤트 기반 호출
  if (typeof eventOrEmail === 'object') {
    const event = eventOrEmail
    const recipients = recipientsOrTitle as string[]

    // 인앱 알림 저장 (전체 수신자)
    for (const email of recipients) {
      await saveInAppNotification(email, event.title, event.body, event.link)
    }

    // Knox 또는 console fallback
    if (process.env.NOTIFY_CHANNEL === 'knox') {
      await sendKnoxNotification(event, recipients)
    } else {
      console.log(`[notify:${event.type}]`, event.title, '→', recipients.join(', '))
    }
    return
  }

  // 하위 호환: 기존 notify(email, title, body, link?) 시그니처 — 인앱 전용
  const recipientEmail = eventOrEmail
  const title = recipientsOrTitle as string
  await saveInAppNotification(recipientEmail, title, body ?? '', link)
}
