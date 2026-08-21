# AX Hub 워크플로우 v22 — 이슈JJ/HH 반영, GG 재확인

**작성일**: 2026-08-21
**전제 문서**: v3~v21 설계안

---

## 1. 이슈GG — 재확인 (이미 v19에서 해결됨)

`AgentRuntimeUsage`의 참조 모델 문제(`Agent` vs `AgentRegistry`)는 v19 §1에서 이미 `agentRegistryId`/`agentRegistry`로 수정 완료했습니다. v10 때처럼 파일 접근 문제로 못 보셨을 가능성이 있어 재전송했습니다. 추가 조치 불필요합니다.

---

## 2. 이슈JJ — 롤업 타이밍: 매 배치마다로 확정

```
❌ "월말 또는 매 배치마다" — 미결로 남겨둔 것 자체가 문제
✅ 매 배치(일 1회)마다 롤업 확정
```

```ts
// collect-llm-usage.ts
async function runCollection() {
  for (const adapter of [anthropicAdapter, openaiAdapter, geminiAdapter]) {
    const records = await adapter.fetchOrgUsage(period)
    const service = VENDOR_SERVICE_MAP[adapter.vendorKey]
    for (const r of records) {
      await upsertDaily(r, service)
    }
  }
  // ▼ v22: 매 배치 실행 끝에 항상 월 롤업 수행 (월말까지 미루지 않음)
  await rollupCurrentMonthToUsageRecord()
}
```

**판단 근거**: 월말에만 롤업하면 `quota.ts`가 `UsageRecord(yearMonth)`를 조회할 때 이번 달 중간의 초과 사용을 감지 못 합니다. 매 배치 롤업이면 최악의 경우 "전일 사용량이 다음 날 배치 때 반영"되는 정도의 지연만 남고, 이 정도는 실시간이 아니어도 되는 쿼터 체크 성격상 허용 가능합니다.

---

## 3. 이슈HH — 인증 이슈 단일 티켓으로 통합

```
❌ auth.ts 정상화(★★★ 최우선) → middleware.ts(그 이후) — 순서 분리
✅ 한 티켓으로 동시 처리
```

**판단 근거**: 순서를 나누면 두 가지 실패 모드가 그대로 발생합니다.
- `auth.ts`만 고치면: SSO 연동 전까지 아무도 로그인 자체가 안 돼서 시스템 접근이 막힘
- `middleware.ts` 없이 `auth.ts`만 고치면: 로그인은 정상화됐지만 `requireRole()` 누락된 개별 라우트는 여전히 우회 가능

두 조치가 서로를 전제하므로 나눠서 처리할 이유가 없습니다.

**티켓 범위 (통합)**:
1. `auth.ts`의 `authorize()`를 실제 SSO/LDAP 검증으로 교체
2. `middleware.ts` 신설, `/api/*` 전역에 인증 게이트
3. 기존 개별 라우트의 `requireRole()`은 그대로 두되(defense in depth), middleware가 1차 방어선

---

## 4. 미결 사항 (v21 대비 갱신)

| 항목 | 내용 |
|---|---|
| ~~AgentRuntimeUsage 참조모델(GG)~~ | 해결됨 (v19에서 이미) |
| ~~롤업 타이밍(JJ)~~ | 해결됨 |
| ~~인증 이슈 처리 순서(HH)~~ | 해결됨 — 단일 티켓 |
| **인증 통합 티켓 착수** | ★★★ 최우선, 남은 유일한 P0 |
| Claude Enterprise Analytics API 키 발급 | v21과 동일 미결 |

---

## 5. 변경 이력 (v21 → v22)

| 항목 | v21 상태 | v22 조치 |
|---|---|---|
| GG | v18에서 제기된 이슈, 해결 여부 불명확하다고 재질문받음 | v19에서 이미 해결됐음을 재확인, 파일 재전송 |
| JJ | "월말 또는 매 배치마다" 미결 | 매 배치(일 1회)마다 롤업으로 확정 |
| HH | auth.ts 정상화와 middleware.ts를 우선순위로 분리 | 단일 티켓으로 통합, 서로 전제하는 관계임을 명시 |
