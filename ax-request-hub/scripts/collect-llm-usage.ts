/**
 * collect-llm-usage.ts — LLM 사용량 배치 수집 스크립트 (WS-B)
 *
 * OpenAI organization-level usage API에서 전일 데이터를 수집해 UsageRecord에 upsert한다.
 * Gemini(Google Cloud Billing API)는 인증 구현 복잡으로 stub 처리.
 *
 * 실행: npm run collect-usage
 */

import { prisma } from '../lib/prisma'

// ─── SYSTEM 직원 upsert ────────────────────────────────────────────────────

async function ensureSystemEmployee(): Promise<string> {
  const systemEmployee = await prisma.employee.upsert({
    where: { email: 'system@ax-hub.internal' },
    update: {},
    create: {
      employeeId: 'SYSTEM',
      email: 'system@ax-hub.internal',
      name: 'System Batch',
      department: 'SYSTEM',
      role: 'EMPLOYEE',
      isActive: false,
    },
  })
  return systemEmployee.id
}

// ─── 날짜 유틸 ────────────────────────────────────────────────────────────

function toYearMonth(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function toDayBounds(date: Date): { startTime: number; endTime: number } {
  const start = new Date(date)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setUTCHours(23, 59, 59, 999)
  return {
    startTime: Math.floor(start.getTime() / 1000),
    endTime: Math.floor(end.getTime() / 1000),
  }
}

// ─── OpenAI 사용량 수집 ───────────────────────────────────────────────────

interface OpenAIUsageBucket {
  input_tokens?: number
  output_tokens?: number
  num_model_requests?: number
  [key: string]: unknown
}

interface OpenAIUsageResponse {
  data?: OpenAIUsageBucket[]
  [key: string]: unknown
}

async function collectOpenAIUsage(
  date: Date,
  systemEmployeeId: string
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY
  const orgId = process.env.OPENAI_ORG_ID

  if (!apiKey) {
    console.warn('[OpenAI] OPENAI_API_KEY 미설정 — 수집 건너뜀')
    return
  }

  const { startTime, endTime } = toDayBounds(date)
  const yearMonth = toYearMonth(date)

  const url = new URL(
    'https://api.openai.com/v1/organization/usage/completions'
  )
  url.searchParams.set('start_time', String(startTime))
  url.searchParams.set('end_time', String(endTime))

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (orgId) {
    headers['OpenAI-Organization'] = orgId
  }

  let body: OpenAIUsageResponse
  try {
    const res = await fetch(url.toString(), { headers })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenAI API 응답 오류 ${res.status}: ${text}`)
    }
    body = (await res.json()) as OpenAIUsageResponse
  } catch (err) {
    console.error('[OpenAI] 사용량 API 호출 실패:', err)
    return
  }

  // 전체 토큰 합산
  const buckets: OpenAIUsageBucket[] = body.data ?? []
  let totalTokens = 0
  for (const bucket of buckets) {
    totalTokens += (bucket.input_tokens ?? 0) + (bucket.output_tokens ?? 0)
  }

  await prisma.usageRecord.upsert({
    where: {
      employeeId_service_yearMonth: {
        employeeId: systemEmployeeId,
        service: 'ChatGPT',
        yearMonth,
      },
    },
    update: {
      tokenUsed: { increment: totalTokens },
      // costKrw는 원화 환산 미구현 — 기존 값 유지하기 위해 update에서 생략
    },
    create: {
      employeeId: systemEmployeeId,
      service: 'ChatGPT',
      yearMonth,
      tokenUsed: totalTokens,
      costKrw: 0, // 원화 환산 미구현, 추후 구현
      inputById: systemEmployeeId,
    },
  })

  console.log(
    `[OpenAI] ${yearMonth} 수집 완료 — 총 토큰: ${totalTokens.toLocaleString()}`
  )
}

// ─── Gemini 사용량 수집 (stub) ────────────────────────────────────────────

async function collectGeminiUsage(
  _date: Date,
  _systemEmployeeId: string
): Promise<void> {
  // TODO: Google Cloud Billing API 또는 Vertex AI Usage API 연동 구현 필요
  // 필요 환경변수: GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS
  // 참고: https://cloud.google.com/billing/docs/reference/rest
  //       https://cloud.google.com/vertex-ai/docs/reference/rest/v1/projects.locations.endpoints/listUsage
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn(
      '[Gemini] 수집 미구현: GOOGLE_APPLICATION_CREDENTIALS 필요 — 건너뜀'
    )
    return
  }
  console.warn('[Gemini] 수집 미구현: 향후 Google Cloud Billing API 연동 예정')
}

// ─── 메인 ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  console.log(`[collect-llm-usage] 수집 대상일: ${yesterday.toISOString().slice(0, 10)}`)

  const systemEmployeeId = await ensureSystemEmployee()
  await collectOpenAIUsage(yesterday, systemEmployeeId)
  await collectGeminiUsage(yesterday, systemEmployeeId)

  console.log('LLM usage collection complete')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
