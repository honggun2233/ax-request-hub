# AX Hub 워크플로우 v20 — A트랙 엔터프라이즈 API 수집 설계

**작성일**: 2026-08-21
**전제 문서**: v3~v19 설계안
**변경 동기**: A트랙(엔터프라이즈 Claude/GPT/Gemini 사용량)을 각 벤더 관리자 API로 수집하는 방향 확정, v11의 잘못된 판단 정정

---

## 1. v11 정정 — `collect-llm-usage.ts`는 폐기가 아니라 확장

v11 이슈5에서 "collect-llm-usage.ts는 폐기하고 UsageEvent로 일원화"라고 했던 건 **A/B트랙을 구분하지 못한 채 내린 잘못된 결론**입니다(v16에서야 구분됨). 이 스크립트는 `OPENAI_ORG_ID`·`GOOGLE_CLOUD_PROJECT` 같은 조직 단위 자격증명을 쓰는데, 이건 온프렘 전환과 무관한 **A트랙 전용 수집기**였습니다. 방금 확정하신 방향(각 엔터프라이즈로부터 API로 수집)이 정확히 이 스크립트가 원래 하려던 일입니다.

**정정**: `collect-llm-usage.ts` 폐기 결정을 철회합니다. 3개 벤더 전체를 커버하도록 확장합니다.

---

## 2. A트랙 수집 아키텍처

```
scripts/collect-llm-usage.ts
  ├── AnthropicAdminAdapter   (신규 — 기존엔 없었음, 이번에 추가)
  ├── OpenAIOrgAdapter        (기존 유지)
  └── GoogleWorkspaceAdapter  (기존 유지)

각 어댑터 → 벤더별 관리자 API로 조직 단위 사용량 조회 → UsageRecord에 upsert
```

```ts
// 어댑터 공통 인터페이스
interface UsageCollectorAdapter {
  vendorKey: 'anthropic' | 'openai' | 'gemini'
  fetchOrgUsage(period: { from: Date; to: Date }): Promise<VendorUsageRecord[]>
}

interface VendorUsageRecord {
  employeeIdentifier: string  // 벤더 API가 반환하는 식별자 → 내부 employeeId로 매핑 필요
  tokenUsed: number
  costKrw: number
  yearMonth: string
}
```

**기존 스키마 그대로 사용**: A트랙은 이미 `UsageRecord`(employeeId·service·yearMonth 유니크)가 있으므로 새 모델이 필요 없습니다. `service` 필드에 `CLAUDE_ENTERPRISE`를 신규 값으로 추가합니다(기존 `GPT_CHAT`·`GEMINI`와 나란히).

---

## 3. 벤더 식별자 매핑 — SSO 연동 확인으로 해결

SSO 연동이 돼 있는 것을 확인했습니다. 벤더별 계정이 전부 SSO 발급 이메일로 통일되므로, 벤더 API가 반환하는 식별자는 `Employee.email`과 그대로 매칭됩니다. **`vendorAccountMap` 같은 별도 매핑 테이블은 불필요합니다** — 스키마 변경 없이 어댑터가 반환하는 `employeeIdentifier`를 `Employee.email`로 바로 조회하면 됩니다.

```ts
// 어댑터 결과를 UsageRecord로 upsert할 때
const employee = await db.employee.findUnique({ where: { email: record.employeeIdentifier } })
```

---

## 4. 수집 주기와 granularity 한계 (정직하게 밝힘)

벤더 관리자 API는 대부분 **일 단위 집계**까지만 제공하고, B/C트랙처럼 호출 단위(event-level) 데이터는 주지 않는 게 일반적입니다. 회의 §7("시간대별로 몰리는 시점도 봐야 한다")을 A트랙에서 그대로 만족시키긴 어렵습니다 — 이건 설계 문제가 아니라 벤더 API 자체의 한계입니다. 시간대별 분석이 꼭 필요하면 일 단위 수집으로 타협하거나, 벤더가 더 세밀한 API를 제공하는지 개별 확인이 필요합니다.

```
수집 주기: 일 1회 배치 (cron)
UsageRecord.yearMonth 단위로 월 누적 upsert
```

---

## 5. 미결 사항 (v19 대비 갱신)

| 항목 | 내용 |
|---|---|
| **A트랙 실행계획** | "정보전략팀 회신 대기"에서 **"3개 벤더 어댑터 구현"으로 구체화** — 더 이상 순수 대기 상태 아님 |
| Anthropic Admin API 스펙 확인 | 신규 — OpenAI/Google과 달리 기존에 연동 이력이 없어 API 문서 확인부터 필요 |
| ~~벤더-내부 계정 식별자 매핑 방식~~ | **해결됨 — SSO 연동 확인, 매핑 테이블 불필요** |
| 시간대별 분석 가능 여부 | 신규 — 벤더 API의 granularity 한계로 제약될 수 있음, 확인 필요 |
| Gate2 `techHasUsageWrapper` 심사항목 | v19와 동일 미결 |
| ~~C트랙 참조모델, 수집방식~~ | v19에서 해결 |
| ~~middleware.ts GitHub 이슈 등록 여부~~ | 여전히 최우선 미결 |

---

## 6. 변경 이력 (v19 → v20)

| 항목 | v19 상태 | v20 조치 |
|---|---|---|
| `collect-llm-usage.ts` | v11에서 폐기 결정(A/B트랙 미구분 상태에서 내린 오판) | 폐기 철회, A트랙 전용 수집기로 확정. Anthropic 어댑터 신규 추가하여 3벤더 완성 |
| A트랙 미결사항 성격 | "정보전략팀 회신 대기"라는 막연한 상태 | 구체적 구현 항목(3개 어댑터, 계정매핑, granularity 확인)으로 전환 |
| 벤더 계정 식별자 매핑 | 미고려 | SSO 연동 확인으로 해결, 별도 필드 불필요 (스키마 변경 취소) |
