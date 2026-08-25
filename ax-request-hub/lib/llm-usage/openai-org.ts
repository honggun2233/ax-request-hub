// OpenAIOrgAdapter — OpenAI Organization Usage API
// 엔드포인트: GET /v1/organization/usage (Organization Admin API Key 필요)

import type { LLMUsageAdapter, VendorUsageRecord } from './types'

const BASE = 'https://api.openai.com/v1'
const KRW_PER_1K_INPUT  = 10
const KRW_PER_1K_OUTPUT = 30

export class OpenAIOrgAdapter implements LLMUsageAdapter {
  readonly vendorKey = 'openai' as const

  constructor(private readonly apiKey: string) {}

  async fetchOrgUsage({ startDate, endDate }: { startDate: string; endDate: string }): Promise<VendorUsageRecord[]> {
    if (!this.apiKey) {
      console.warn('[OpenAIOrgAdapter] API 키 미설정 — 빈 결과 반환')
      return []
    }

    const start = Math.floor(new Date(startDate).getTime() / 1000)
    const end   = Math.floor(new Date(endDate).getTime()   / 1000)

    const url = `${BASE}/organization/usage/completions?start_time=${start}&end_time=${end}&group_by=user&bucket_duration=1d`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenAI Org API 오류 ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const buckets: any[] = data.data ?? []
    const result: VendorUsageRecord[] = []

    for (const bucket of buckets) {
      const date = new Date(bucket.start_time * 1000).toISOString().slice(0, 10)
      for (const item of bucket.results ?? []) {
        const email = item.user?.email ?? item.user_id ?? 'unknown'
        const inputTokens  = item.input_tokens  ?? 0
        const outputTokens = item.output_tokens ?? 0
        result.push({
          employeeIdentifier: email,
          date,
          tokenUsed: inputTokens + outputTokens,
          costKrw: Math.round(inputTokens / 1000 * KRW_PER_1K_INPUT + outputTokens / 1000 * KRW_PER_1K_OUTPUT),
        })
      }
    }

    return result
  }
}
