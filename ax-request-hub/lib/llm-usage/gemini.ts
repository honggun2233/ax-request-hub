// GeminiAdapter — Google Cloud AI Platform / Vertex AI 사용량 API
// Workspace 계약 시: Admin SDK 또는 Cloud Monitoring API

import type { LLMUsageAdapter, VendorUsageRecord } from './types'

const KRW_PER_1K_INPUT  = 8
const KRW_PER_1K_OUTPUT = 24

export class GeminiAdapter implements LLMUsageAdapter {
  readonly vendorKey = 'gemini' as const

  constructor(
    private readonly projectId: string,
    private readonly accessToken: string,
  ) {}

  async fetchOrgUsage({ startDate, endDate }: { startDate: string; endDate: string }): Promise<VendorUsageRecord[]> {
    if (!this.accessToken || !this.projectId) {
      console.warn('[GeminiAdapter] 설정 미완성 — 빈 결과 반환')
      return []
    }

    // Cloud Monitoring API: timeSeries for aiplatform.googleapis.com/prediction/online/token_count
    const filter = [
      `metric.type="aiplatform.googleapis.com/prediction/online/token_count"`,
      `resource.labels.project_id="${this.projectId}"`,
    ].join(' AND ')

    const url = new URL(`https://monitoring.googleapis.com/v3/projects/${this.projectId}/timeSeries`)
    url.searchParams.set('filter', filter)
    url.searchParams.set('interval.startTime', `${startDate}T00:00:00Z`)
    url.searchParams.set('interval.endTime',   `${endDate}T23:59:59Z`)
    url.searchParams.set('aggregation.alignmentPeriod', '86400s')
    url.searchParams.set('aggregation.crossSeriesReducer', 'REDUCE_SUM')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gemini (Cloud Monitoring) API 오류 ${res.status}: ${text.slice(0, 200)}`)
    }

    // Gemini는 사용자별 분리가 어려움 — org 집계만 반환 (user=org)
    const data = await res.json()
    const series: any[] = data.timeSeries ?? []
    const result: VendorUsageRecord[] = []

    for (const ts of series) {
      for (const point of ts.points ?? []) {
        const date     = point.interval?.startTime?.slice(0, 10) ?? startDate
        const tokens   = parseInt(point.value?.int64Value ?? '0', 10)
        result.push({
          employeeIdentifier: 'org@gemini',
          date,
          tokenUsed: tokens,
          costKrw: Math.round(tokens / 1000 * (KRW_PER_1K_INPUT + KRW_PER_1K_OUTPUT) / 2),
        })
      }
    }

    return result
  }
}
