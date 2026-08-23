/**
 * collect-llm-usage.ts — A트랙 LLM 사용량 배치 수집 스크립트
 *
 * 각 벤더 관리자 API로 전일 사용량을 수집 → UsageRecordDaily에 저장
 * → rollupCurrentMonthToUsageRecord()로 UsageRecord에 월 집계 (전체 SUM, v23 KK 확정)
 *
 * 실행: npm run collect-usage [YYYY-MM-DD]
 *   날짜 인자 생략 시 전일(UTC) 자동 계산
 *
 * 필요 환경변수:
 *   ANTHROPIC_ADMIN_API_KEY  — Anthropic Primary Owner 발급 Admin key
 *   ANTHROPIC_WORKSPACE_ID   — (선택) 특정 워크스페이스 한정
 *   OPENAI_API_KEY           — OpenAI Organization Admin key
 *   OPENAI_ORG_ID            — (선택) 조직 ID
 *   GOOGLE_APPLICATION_CREDENTIALS — Gemini (미구현, stub)
 */

import { prisma } from '../lib/prisma'

// ─── 날짜 유틸 ────────────────────────────────────────────────────────────────

function toYearMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// ─── 공통 인터페이스 ──────────────────────────────────────────────────────────

interface VendorUsageRecord {
  /** SSO 이메일 — Employee.email과 매핑 (v20: SSO 연동 확인, 별도 매핑 테이블 불필요) */
  employeeIdentifier: string
  tokenUsed: number
  costKrw: number
}

interface UsageCollectorAdapter {
  readonly vendorKey: 'CLAUDE_ENTERPRISE' | 'GPT_CHAT' | 'GEMINI'
  isConfigured(): boolean
  fetchDayUsage(date: Date): Promise<VendorUsageRecord[]>
}

// ─── SYSTEM 직원 upsert ───────────────────────────────────────────────────────

async function ensureSystemEmployee(): Promise<string> {
  const sys = await prisma.employee.upsert({
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
  return sys.id
}

// ─── Anthropic Admin API 어댑터 ───────────────────────────────────────────────
// Anthropic Enterprise 관리자 API로 워크스페이스 단위 사용량 수집
// 참고: https://docs.anthropic.com/en/api/admin-api/usage
// API key: Primary Owner → API keys → "Admin" 스코프 발급

interface AnthropicUsageBucket {
  user_email?: string
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

class AnthropicAdminAdapter implements UsageCollectorAdapter {
  readonly vendorKey = 'CLAUDE_ENTERPRISE' as const

  private readonly adminKey = process.env.ANTHROPIC_ADMIN_API_KEY
  private readonly workspaceId = process.env.ANTHROPIC_WORKSPACE_ID

  isConfigured(): boolean {
    return !!this.adminKey
  }

  async fetchDayUsage(date: Date): Promise<VendorUsageRecord[]> {
    const dateStr = toDateString(date)

    const url = new URL('https://api.anthropic.com/v1/usage')
    url.searchParams.set('start_date', dateStr)
    url.searchParams.set('end_date', dateStr)
    url.searchParams.set('group_by', 'user')
    if (this.workspaceId) {
      url.searchParams.set('workspace_id', this.workspaceId)
    }

    const res = await fetch(url.toString(), {
      headers: {
        'x-api-key': this.adminKey!,
        'anthropic-version': '2023-06-01',
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Anthropic Admin API ${res.status}: ${text}`)
    }

    const body = (await res.json()) as { data?: AnthropicUsageBucket[] }
    return (body.data ?? [])
      .filter((b) => b.user_email)
      .map((b) => ({
        employeeIdentifier: b.user_email!,
        tokenUsed:
          (b.input_tokens ?? 0) +
          (b.output_tokens ?? 0) +
          (b.cache_read_input_tokens ?? 0) +
          (b.cache_creation_input_tokens ?? 0),
        costKrw: 0, // 환율·모델별 단가 환산 미구현 — 추후 추가
      }))
  }
}

// ─── OpenAI Organization Admin API 어댑터 ────────────────────────────────────
// OpenAI Organization Usage API로 조직 전체 사용량 수집
// user_id 역조회: organization/users/{id} (Admin key 필요)

interface OpenAIUsageBucket {
  user_id?: string
  input_tokens?: number
  output_tokens?: number
}

class OpenAIOrgAdapter implements UsageCollectorAdapter {
  readonly vendorKey = 'GPT_CHAT' as const

  private readonly apiKey = process.env.OPENAI_API_KEY
  private readonly orgId = process.env.OPENAI_ORG_ID

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async fetchDayUsage(date: Date): Promise<VendorUsageRecord[]> {
    const start = new Date(date)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setUTCHours(23, 59, 59, 999)

    const url = new URL('https://api.openai.com/v1/organization/usage/completions')
    url.searchParams.set('start_time', String(Math.floor(start.getTime() / 1000)))
    url.searchParams.set('end_time', String(Math.floor(end.getTime() / 1000)))
    url.searchParams.set('group_by', 'user')

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey!}`,
    }
    if (this.orgId) headers['OpenAI-Organization'] = this.orgId

    const res = await fetch(url.toString(), { headers })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenAI API ${res.status}: ${text}`)
    }

    const body = (await res.json()) as { data?: OpenAIUsageBucket[] }
    const buckets = body.data ?? []

    const records: VendorUsageRecord[] = []
    for (const bucket of buckets) {
      const email = await this.resolveUserEmail(bucket.user_id)
      records.push({
        employeeIdentifier: email,
        tokenUsed: (bucket.input_tokens ?? 0) + (bucket.output_tokens ?? 0),
        costKrw: 0,
      })
    }
    return records
  }

  // OpenAI user_id(UUID) → 이메일 역조회 (Admin key 필요)
  // 권한 없으면 'unknown@openai.local'로 fallback → systemEmployee에 귀속
  private async resolveUserEmail(userId: string | undefined): Promise<string> {
    if (!userId) return 'unknown@openai.local'
    try {
      const res = await fetch(
        `https://api.openai.com/v1/organization/users/${userId}`,
        { headers: { Authorization: `Bearer ${this.apiKey!}` } }
      )
      if (!res.ok) return 'unknown@openai.local'
      const user = (await res.json()) as { email?: string }
      return user.email ?? 'unknown@openai.local'
    } catch {
      return 'unknown@openai.local'
    }
  }
}

// ─── Gemini 어댑터 (stub) ─────────────────────────────────────────────────────
// TODO: Google Cloud Billing API 또는 Vertex AI Usage API 연동
// 참고: https://cloud.google.com/billing/docs/reference/rest

class GeminiAdapter implements UsageCollectorAdapter {
  readonly vendorKey = 'GEMINI' as const

  isConfigured(): boolean {
    return !!process.env.GOOGLE_APPLICATION_CREDENTIALS
  }

  async fetchDayUsage(_date: Date): Promise<VendorUsageRecord[]> {
    console.warn('[GEMINI] 수집 미구현: Google Cloud Billing API 연동 예정')
    return []
  }
}

// ─── UsageRecordDaily upsert ──────────────────────────────────────────────────

async function upsertDailyRecords(
  records: VendorUsageRecord[],
  service: string,
  date: Date,
  systemEmployeeId: string
): Promise<void> {
  const dateStr = toDateString(date)
  let upserted = 0
  let skipped = 0

  for (const rec of records) {
    // SSO 이메일 → 내부 Employee.id 조회
    // 'unknown@' 접두사나 내부 도메인은 system 계정에 귀속
    const isUnknown =
      rec.employeeIdentifier.startsWith('unknown@') ||
      rec.employeeIdentifier.endsWith('@ax-hub.internal')

    const empId = isUnknown
      ? systemEmployeeId
      : (
          await prisma.employee.findUnique({
            where: { email: rec.employeeIdentifier },
            select: { id: true },
          })
        )?.id

    if (!empId) {
      console.warn(`  [skip] 매핑 불가 계정: ${rec.employeeIdentifier}`)
      skipped++
      continue
    }

    await prisma.usageRecordDaily.upsert({
      where: {
        employeeId_service_date: {
          employeeId: empId,
          service,
          date: dateStr,
        },
      },
      update: { tokenUsed: rec.tokenUsed, costKrw: rec.costKrw },
      create: {
        employeeId: empId,
        service,
        date: dateStr,
        tokenUsed: rec.tokenUsed,
        costKrw: rec.costKrw,
      },
    })
    upserted++
  }

  console.log(
    `  [${service}] ${dateStr}: upsert ${upserted}건, skip ${skipped}건`
  )
}

// ─── 월 롤업 (v23 KK: 전체 SUM 방식) ─────────────────────────────────────────
// 매일 전체 재계산 → 벤더 소급 정정도 다음 배치에서 자동 반영
// 직원 수 × 3서비스 × 30일 ≈ 수천 행이라 성능 문제 없음

async function rollupCurrentMonthToUsageRecord(
  yearMonth: string,
  systemEmployeeId: string
): Promise<void> {
  const grouped = await (prisma.usageRecordDaily as any).groupBy({
    by: ['employeeId', 'service'],
    where: { date: { startsWith: yearMonth } },
    _sum: { tokenUsed: true, costKrw: true },
  })

  let rolled = 0
  for (const g of grouped as { employeeId: string; service: string; _sum: { tokenUsed: number | null; costKrw: number | null } }[]) {
    await prisma.usageRecord.upsert({
      where: {
        employeeId_service_yearMonth: {
          employeeId: g.employeeId,
          service: g.service,
          yearMonth,
        },
      },
      update: {
        tokenUsed: g._sum.tokenUsed ?? 0,
        costKrw: g._sum.costKrw ?? 0,
      },
      create: {
        employeeId: g.employeeId,
        service: g.service,
        yearMonth,
        tokenUsed: g._sum.tokenUsed ?? 0,
        costKrw: g._sum.costKrw ?? 0,
        inputById: systemEmployeeId,
      },
    })
    rolled++
  }
  console.log(`[rollup] ${yearMonth} → UsageRecord ${rolled}건 업데이트`)
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

const ADAPTERS: UsageCollectorAdapter[] = [
  new AnthropicAdminAdapter(),
  new OpenAIOrgAdapter(),
  new GeminiAdapter(),
]

async function main(): Promise<void> {
  const targetDateArg = process.argv[2]
  const targetDate = targetDateArg
    ? new Date(`${targetDateArg}T00:00:00Z`)
    : (() => {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() - 1)
        return d
      })()

  const dateStr = toDateString(targetDate)
  const yearMonth = toYearMonth(targetDate)
  console.log(`[collect-llm-usage] 수집 대상일: ${dateStr}`)

  const systemEmployeeId = await ensureSystemEmployee()

  for (const adapter of ADAPTERS) {
    if (!adapter.isConfigured()) {
      console.warn(`[${adapter.vendorKey}] 환경변수 미설정 — 건너뜀`)
      continue
    }
    console.log(`[${adapter.vendorKey}] 수집 시작...`)
    try {
      const records = await adapter.fetchDayUsage(targetDate)
      await upsertDailyRecords(records, adapter.vendorKey, targetDate, systemEmployeeId)
    } catch (err) {
      console.error(`[${adapter.vendorKey}] 수집 실패:`, err)
    }
  }

  await rollupCurrentMonthToUsageRecord(yearMonth, systemEmployeeId)

  console.log('[collect-llm-usage] 완료')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
