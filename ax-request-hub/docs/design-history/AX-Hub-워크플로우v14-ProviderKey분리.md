# AX Hub 워크플로우 v14 — ProviderKey 분리 확정 + v10 재검토 완료

**작성일**: 2026-08-21
**전제 문서**: v3~v13 설계안

---

## 1. 설계 원칙 (v13에 추가)

11. **프로바이더 식별자는 실제 벤더와 정확히 일치해야 한다**: 공유하면 사용량·쿼터·비용 데이터가 서로 다른 벤더의 것과 뒤섞여 오염된다. 타입 전파 비용은 1회성이지만 데이터 오염은 운영 중 계속 반복되는 비용이라, 식별자 분리가 항상 우선한다.

---

## 2. 이슈T — Qwen3 ProviderKey 결정: 옵션B 채택

```
❌ 옵션A: getAdapter('openai')로 Qwen3 라우팅
   → quota.ts가 실제 OpenAI API 사용량과 온프렘 Qwen3 사용량을 같은 키로 합산
   → 예산 대시보드에서 "OpenAI 사용량 급증" 알림이 실은 온프렘 무료 호출일 수 있음
   → 온프렘만 따로 쿼터 관리하고 싶어도 분리 불가

✅ 옵션B: ProviderKey에 'onprem' 신설, OpenAI 호환 어댑터 로직 상속/재사용
   → 코드 구현(OpenAI 호환 API 호출 로직)은 그대로 재사용
   → 식별자만 분리해서 quota.ts·UsageEvent 양쪽에서 실제 벤더 구분 유지
```

```ts
// types.ts
export type ProviderKey = 'anthropic' | 'openai' | 'gemini' | 'onprem'

// registry.ts
registerAdapter('onprem', createOpenAICompatibleAdapter({
  baseUrl: process.env.ONPREM_LLM_BASE_URL,
  // 나머지 요청/응답 처리 로직은 openai.ts 어댑터 재사용
}))
```

**영향 범위**: `types.ts`(ProviderKey 타입 확장), `registry.ts`(어댑터 등록 1건 추가), `quota.ts`(onprem 쿼터 정책 — 기본은 무제한 또는 별도 GPU 처리량 상한). `UsageEvent.service`는 기존 그대로(GOVERNANCE_INTAKE 등) 유지하고, 실제 호출 벤더는 별도 필드로 기록해야 온프렘/클라우드 구분이 됩니다.

```prisma
model UsageEvent {
  // ... 기존 필드 유지 ...

  // ▼ 신규: 실제 호출 벤더 구분 (이슈T)
  providerKey  String   // anthropic | openai | gemini | onprem
}
```

---

## 3. 이슈R 잔여 — v10 재검토 완료

v10 §1을 직접 열어 확인했습니다. `costKrw Decimal` (어노테이션 없이)로 정확히 반영돼 있고, v9 이슈K는 v10에서 올바르게 처리된 게 맞습니다. 이번엔 "반영했다고 서술"이 아니라 파일을 실제로 열어 대조 확인했습니다.

---

## 4. 미결 사항 (v13 대비 갱신)

| 항목 | 내용 |
|---|---|
| onprem 쿼터 정책 | GPU 처리량 상한을 둘지, 무제한으로 둘지 미정 |
| ~~v10 이슈K 반영 여부~~ | **해결됨 — 직접 확인 완료** |
| ~~AI Gateway 존재 여부~~ | v13에서 해결됨 |
| ~~middleware.ts GitHub 이슈 등록 여부~~ | 여전히 최우선 미결 |
| ~~CONTEXT_EXCEEDED 청크분할, Qwen3 전환시점, costKrw 인프라예산~~ | v11~v13과 동일 미결 |

---

## 5. 변경 이력 (v13 → v14)

| 항목 | v13 상태 | v14 조치 |
|---|---|---|
| T | Qwen3가 `getAdapter('openai')`를 공유해서 씀 — 혼선 가능성 미결 | 원칙11 신설, `ProviderKey`에 `'onprem'` 추가(옵션B). `UsageEvent`에 `providerKey` 필드 신설해서 실제 벤더 추적 |
| R 잔여 | "v10에 반영됨"이라고 서술만 함, 직접 재확인 안 함 | v10 §1 직접 열람·대조, 정확히 반영된 것 확인 |
