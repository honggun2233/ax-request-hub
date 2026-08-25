// AnthropicAnalyticsAdapter
// Claude Enterprise(채팅 플랜) 전용 — Analytics API (Admin API 아님)
// API Key: claude.ai/analytics/api-keys (Primary Owner, read:analytics 스코프)
// 참고 v21: CC 이슈 해결 확정

import type { LLMUsageAdapter, VendorUsageRecord } from './types'

const BASE = 'https://api.claude.ai/analytics/v1'

interface AnthropicDailyUsage {
  date: string
  user_email: string
  input_tokens: number
  output_tokens: number
  // 비용은 API가 직접 안 줄 수 있으므로 토큰 기반 추산
}

const KRW_PER_1K_INPUT  = 12   // 대략적 원화 환산 (운영 시 조정)
const KRW_PER_1K_OUTPUT = 36

export class AnthropicAnalyticsAdapter implements LLMUsageAdapter {
  readonly vendorKey = 'anthropic' as const

  constructor(private readonly apiKey: string) {}

  async fetchOrgUsage({ startDate, endDate }: { startDate: string; endDate: string }): Promise<VendorUsageRecord[]> {
    if (!this.apiKey) {
      console.warn('[AnthropicAnalyticsAdapter] API 키 미설정 — 빈 결과 반환')
      return []
    }

    const url = `${BASE}/usage?start_date=${startDate}&end_date=${endDate}&granularity=daily`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Anthropic Analytics API 오류 ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const items: AnthropicDailyUsage[] = data.data ?? data.usage ?? []

    return items.map(item => ({
      employeeIdentifier: item.user_email,
      date:               item.date,
      tokenUsed:          (item.input_tokens ?? 0) + (item.output_tokens ?? 0),
      costKrw:            Math.round(
        (item.input_tokens  ?? 0) / 1000 * KRW_PER_1K_INPUT +
        (item.output_tokens ?? 0) / 1000 * KRW_PER_1K_OUTPUT
      ),
    }))
  }
}
