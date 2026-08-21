# AX Hub 워크플로우 v21 — 이슈CC/DD/EE 반영

**작성일**: 2026-08-21
**전제 문서**: v3~v20 설계안

---

## 1. 이슈CC — Anthropic 수집 경로 확정

```
조직 형태에 따라 API가 다릅니다:
  API/Console 조직     → Admin API (sk-ant-admin-* 키)
                          /v1/organizations/usage_report/messages
                          /v1/organizations/cost_report

  Claude Enterprise    → Analytics API (read:analytics 스코프)
  (채팅 플랜, 지금 계약)   claude.ai/analytics/api-keys 에서 Primary Owner가 발급
                          사용자 단위·일 단위 집계, 최대 90일 히스토리(2026-01-01~)
```

**확정**: 삼성자산운용이 계약하는 건 Claude Enterprise(채팅 플랜)이므로 **Analytics API**가 맞는 경로입니다. Admin API 키로는 Enterprise 조직 데이터에 접근이 안 됩니다. v20에서 "보류 상태"로 뒀던 걸 "Analytics API 키 발급"으로 구체화합니다.

```
확인/조치 필요:
  1. Primary Owner 권한으로 claude.ai/analytics/api-keys 접속
  2. read:analytics 스코프로 키 발급
  3. AnthropicAdminAdapter → AnthropicAnalyticsAdapter로 이름 정정 (실제 쓰는 API와 이름 일치)
```

---

## 2. 이슈DD — 일 단위 원본 저장 구조 도입

Anthropic Enterprise Analytics API가 실제로 **일 단위 집계 데이터**를 제공한다는 게 확인됐으므로, 수집 구조를 일 단위 원본 + 월 단위 롤업으로 분리합니다.

```prisma
// ▼ 신규: 벤더 API가 주는 원본 그대로 일 단위 저장
model UsageRecordDaily {
  id         String   @id @default(cuid())
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id])
  service    String   // CLAUDE_ENTERPRISE | GPT_CHAT | GEMINI
  date       String   // "2026-08-21" (일 단위)
  tokenUsed  Int
  costKrw    Decimal

  @@unique([employeeId, service, date])
  @@index([date])
}
```

```
수집 스크립트 로직:
  1. 벤더 API에서 일 단위 데이터 fetch
  2. UsageRecordDaily에 upsert (원본 그대로 보존)
  3. 월말 또는 매 배치마다 해당 월의 UsageRecordDaily를 SUM → UsageRecord(yearMonth)에 upsert
```

**효과**: 기존 `UsageRecord`(월 단위, 대시보드·쿼터 체크용)는 그대로 유지하면서, 회의 §7("시간대별로 몰리는 시점")에서 요구했던 최소 단위(일 단위까지는)를 A트랙에서도 확보합니다. 시간(hour) 단위는 벤더가 그렇게까지 세밀하게 안 주므로 여전히 안 됩니다 — v20에서 밝힌 한계 그대로 유지.

```ts
interface VendorUsageRecord {
  employeeIdentifier: string
  date: string        // ▼ v21 신규 — yearMonth 대신 일 단위로 변경
  tokenUsed: number
  costKrw: number
}
```

---

## 3. 이슈EE — vendorKey→service 매핑 소유권 확정

**결정: 수집 스크립트(`collect-llm-usage.ts`)가 소유합니다. 각 어댑터는 관여하지 않습니다.**

```ts
// collect-llm-usage.ts — 여기서만 매핑 관리
const VENDOR_SERVICE_MAP: Record<ProviderKey, string> = {
  anthropic: 'CLAUDE_ENTERPRISE',
  openai:    'GPT_CHAT',
  gemini:    'GEMINI',
  // onprem은 이 맵에 없음 — A트랙 수집 대상이 아니므로 여기 들어올 일 없음(v16 트랙 구분 유지)
}

async function runCollection() {
  for (const adapter of [anthropicAdapter, openaiAdapter, geminiAdapter]) {
    const records = await adapter.fetchOrgUsage(period)
    const service = VENDOR_SERVICE_MAP[adapter.vendorKey]
    for (const r of records) {
      await upsertDaily(r, service)
    }
  }
}
```

**판단 근거**: 어댑터는 "벤더 API 응답을 공통 인터페이스로 변환"만 담당하는 게 맞고, "어느 service 값으로 분류할지"는 AX Hub 내부 운영 판단(예: GPT_CHAT과 GPT_EXCEL을 나눌지 등)이라 어댑터가 알 필요가 없는 정보입니다. 매핑이 바뀔 때 어댑터 코드를 건드리지 않아도 되는 이점도 있습니다.

---

## 4. 미결 사항 (v20 대비 갱신)

| 항목 | 내용 |
|---|---|
| Claude Enterprise Analytics API 키 발급 | 신규 — Primary Owner 확인 및 발급 실행 필요 |
| ~~Anthropic Admin API 존재 여부~~ | **해결됨 — Analytics API로 확정** |
| ~~수집 granularity·모델 불일치~~ | **해결됨 — UsageRecordDaily 도입** |
| ~~vendorKey→service 매핑 위치~~ | **해결됨 — 수집 스크립트 소유로 확정** |
| 시간(hour) 단위 분석 | 벤더 API 한계로 여전히 불가 — v20과 동일 |
| **로그인 스텁(auth.ts) 정상화** | ★★★ 최우선 — SSO/LDAP 연동 전 임시 자동로그인 상태 |
| middleware.ts 전역 인증 게이트 | 로그인 스텁 해결 이후 판단 |

---

## 5. 변경 이력 (v20 → v21)

| 항목 | v20 상태 | v21 조치 |
|---|---|---|
| CC | Anthropic Admin API 존재 여부 불확실, 구현 보류 | 웹 검색으로 확인 — Claude Enterprise는 Analytics API(Admin API 아님)가 정확한 경로. 어댑터명도 `AnthropicAnalyticsAdapter`로 정정 |
| DD | `VendorUsageRecord.yearMonth`와 "일 1회 배치"가 불일치 | `date`(일 단위) 필드로 변경, `UsageRecordDaily` 원본 테이블 신설 + 월 롤업 구조로 재설계 |
| EE | vendorKey→service 매핑 위치 미정 | 수집 스크립트(`collect-llm-usage.ts`)가 `VENDOR_SERVICE_MAP`으로 단독 소유, 어댑터는 관여 안 함 |
