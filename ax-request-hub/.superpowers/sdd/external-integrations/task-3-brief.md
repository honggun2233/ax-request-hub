# Task 3 Brief: WS-C — Samsung Knox 알림 연동

## 목표
기존 lib/notify.ts의 단순 인앱 알림을 Knox 사내 채널 알림으로 확장한다.
기존 함수 시그니처 호환 유지.

## 작업 디렉토리
`/c/project/_cto/ax-hub/ax-request-hub/` (git worktree, 브랜치: feat/external-integrations)

## 현재 lib/notify.ts (전체)
```typescript
import { prisma } from "@/lib/prisma";

/** 인앱 알림 생성 — Telegram 대체. 수신자는 이메일 기준 (Project.requesterEmail 등과 일치) */
export async function notify(recipientEmail: string, title: string, body: string, link?: string) {
  try {
    await prisma.notification.create({ data: { recipientEmail, title, body, link } });
  } catch (e) {
    console.error("notify failed", e);
  }
}
```

## 구현 사항

### lib/notify.ts 전면 재작성

```typescript
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

  await fetch(`${endpoint}/notify/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Sender-Id': senderId ?? 'ax-team',
    },
    body: JSON.stringify({
      recipients,
      subject: event.title,
      message: event.body,
      link: event.link,
    }),
  })
}

// ── 인앱 알림 (DB) ────────────────────────────────────────
async function saveInAppNotification(recipientEmail: string, title: string, body: string, link?: string): Promise<void> {
  try {
    await prisma.notification.create({ data: { recipientEmail, title, body, link } })
  } catch (e) {
    console.error("notify failed", e)
  }
}

// ── 메인 notify 함수 (하위 호환 + Knox) ──────────────────
// 오버로드 1: 기존 시그니처 (하위 호환)
export async function notify(recipientEmail: string, title: string, body: string, link?: string): Promise<void>
// 오버로드 2: 이벤트 기반
export async function notify(event: NotifyEvent, recipients: string[]): Promise<void>

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
    
    // 항상 인앱 알림 저장
    for (const email of recipients) {
      await saveInAppNotification(email, event.title, event.body, event.link)
    }
    
    // Knox 또는 console
    if (process.env.NOTIFY_CHANNEL === 'knox') {
      await sendKnoxNotification(event, recipients)
    } else {
      console.log(`[notify:${event.type}]`, event.title, '→', recipients.join(', '))
    }
    return
  }

  // 하위 호환: 기존 notify(email, title, body, link?) 시그니처
  const recipientEmail = eventOrEmail
  const title = recipientsOrTitle as string
  await saveInAppNotification(recipientEmail, title, body ?? '', link)
}
```

### 기존 notify() 호출 위치 탐색 및 Knox 이벤트 주입
프로젝트 내 notify() 호출 위치를 찾아서:
1. 에스컬레이션 알림 → NotifyEvent type: 'TASK_ESCALATED' 로 변환
2. Gate 전환 알림 → type: 'GATE_TRANSITION'
3. 토큰 경고 알림 → type: 'TOKEN_WARNING' 또는 'TOKEN_EXCEEDED'
4. 데이터 요청 업데이트 → type: 'DATA_REQUEST_UPDATE'

기존 단순 notify(email, title, body) 호출은 그대로 두어도 됨 (하위 호환).
Knox 이벤트 타입이 명확한 곳만 이벤트 기반으로 변환.

### .env.example에 추가할 섹션 (기존 파일에 추가)
```env
# --- Knox 알림 (WS-C) ---
NOTIFY_CHANNEL=console
KNOX_API_ENDPOINT=https://knox-internal.example.com/api/v1
KNOX_API_KEY=your-knox-api-key
KNOX_SENDER_ID=ax-team
```

## Global Constraints
- 기존 notify(email, title, body, link?) 시그니처는 반드시 그대로 동작해야 함
- TypeScript strict 준수 — 함수 오버로드 타입 정확히
- Knox API 실제 URL은 환경변수에서만 — 하드코딩 금지
- 알림 실패가 메인 트랜잭션을 막으면 안 됨 (try-catch 유지)

## 리포트
완료 후 `/c/project/_cto/ax-hub/ax-request-hub/.superpowers/sdd/external-integrations/task-3-report.md`에 작성:
- 상태: DONE | DONE_WITH_CONCERNS | BLOCKED
- 커밋 해시
- tsc 결과 1줄
- 변경된 notify() 호출 위치 목록 (있으면)
- 우려 사항
