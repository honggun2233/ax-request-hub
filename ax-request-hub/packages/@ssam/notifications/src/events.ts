import type { PrismaClient } from '@prisma/client'

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
        Authorization: `Bearer ${apiKey}`,
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

async function saveInAppNotification(
  db: PrismaClient,
  recipientEmail: string,
  title: string,
  body: string,
  link?: string,
): Promise<void> {
  try {
    await db.notification.create({ data: { recipientEmail, title, body, link } })
  } catch (e) {
    console.error('[notify] DB 저장 실패', e)
  }
}

// 오버로드 1: 이벤트 기반 (Knox + 인앱)
export async function notify(db: PrismaClient, event: NotifyEvent, recipients: string[]): Promise<void>
// 오버로드 2: 기존 시그니처 (인앱 전용)
export async function notify(db: PrismaClient, recipientEmail: string, title: string, body: string, link?: string): Promise<void>
// 구현
export async function notify(
  db: PrismaClient,
  eventOrEmail: NotifyEvent | string,
  recipientsOrTitle: string[] | string,
  body?: string,
  link?: string,
): Promise<void> {
  if (typeof eventOrEmail === 'object') {
    const event = eventOrEmail
    const recipients = recipientsOrTitle as string[]
    for (const email of recipients) {
      await saveInAppNotification(db, email, event.title, event.body, event.link)
    }
    if (process.env.NOTIFY_CHANNEL === 'knox') {
      await sendKnoxNotification(event, recipients)
    } else {
      console.log(`[notify:${event.type}]`, event.title, '→', recipients.join(', '))
    }
    return
  }
  const recipientEmail = eventOrEmail
  const title = recipientsOrTitle as string
  await saveInAppNotification(db, recipientEmail, title, body ?? '', link)
}
