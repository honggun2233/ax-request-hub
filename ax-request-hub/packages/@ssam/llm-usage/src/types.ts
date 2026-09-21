// A-트랙 벤더 어댑터 공통 인터페이스 (v21 확정)
// vendorKey→service 매핑은 collect-llm-usage.ts 단독 소유 (어댑터 관여 안 함)

export interface VendorUsageRecord {
  employeeIdentifier: string  // 이메일 또는 벤더 내 사용자 ID
  date: string                // "2026-08-21" (일 단위, UTC)
  tokenUsed: number
  costKrw: number
}

export interface LLMUsageAdapter {
  vendorKey: 'anthropic' | 'openai' | 'gemini'
  /** 벤더 API에서 지정 기간의 일별 사용량을 가져옴 */
  fetchOrgUsage(params: { startDate: string; endDate: string }): Promise<VendorUsageRecord[]>
}
