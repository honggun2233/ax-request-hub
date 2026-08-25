# AX Hub 모델 라우팅 + 카탈로그 개발 기획 — 코드 리뷰

**대상**: `AX Hub — 모델 라우팅 + 카탈로그 개발 기획` (기준일 2026-08-25)
**검토일**: 2026-08-21

---

## 결론

구조와 순서는 합리적이나, "G3는 온프렘 강제, 예외 없음"이라는 절대 원칙이 기본값 설계 때문에 실제로는 안 지켜질 수 있는 구멍이 있습니다. 배포 전 반드시 수정이 필요합니다.

---

## 🔴 Critical — `confidentialityLevel` 기본값이 fail-open

```ts
const level = routing.confidentialityLevel ?? 'G2'   // 안 넘기면 G2로 간주
```

"G3는 온프렘 강제, 예외 없음"이 지켜지려면 **호출하는 쪽이 매번 정확히 confidentialityLevel을 넘겨야** 합니다. 안 넘기면 조용히 G2로 간주되어 클라우드(Anthropic)로 갑니다. 호출 지점 하나만 실수로 이 값을 빼먹어도 G3 데이터가 클라우드로 샙니다.

**실제로 이미 벌어지고 있음**: 2-2 표에서 `intake/parse`·`synthesize`는 `confidentialityLevel`을 명시적으로 넘기지만, **`admin/agents/[id]/score/route.ts`(KPI_EVAL)는 `taskType`만 넘기고 `confidentialityLevel`이 안 보입니다.** 이 상태로 배포되면 G3 등급 에이전트의 KPI 평가가 기본값(G2)으로 떨어져 Anthropic 클라우드로 나갈 수 있습니다.

**수정**:
1. 기본값을 `'G2'`가 아니라 `'G3'`로 변경 — "모르면 가장 안전한 쪽(온프렘)으로"가 맞는 방향
2. `score/route.ts`에 `confidentialityLevel` 전달 추가

---

## 🔴 Critical — `UsageRecord`(월단위 집계)에 `providerKey`/`taskType`을 넣으면 정확한 집계가 불가능

```prisma
model UsageRecord {
  providerKey  String?
  taskType     String?
}
```

`UsageRecord`는 `(employeeId, service, yearMonth)` 유니크 제약의 **월간 집계** 테이블입니다. 같은 달에 같은 service로 Qwen 호출과 Anthropic 호출이 둘 다 있으면 한쪽이 다른 쪽 필드값을 덮어씁니다. "Qwen이 분기별로 얼마나 절감했는지 조회 가능"이라 되어 있지만, 지금 구조로는 이 조회가 정확한 값을 낼 수 없습니다.

**수정**: 이 필드들은 이벤트(호출) 단위 테이블에 있어야 정확합니다. `UsageRecord`가 아니라 매 호출마다 기록되는 별도 이벤트 테이블에 넣어야, provider별·taskType별 합산이 정확해집니다.

---

## 🟠 High — 모델 카탈로그가 실제 라우팅 로직과 연결되어 있지 않음

`routing.ts`의 규칙은 `if (confidentialityLevel === 'G3') return 'onprem'`처럼 하드코딩된 문자열 비교입니다. `ModelProvider.maxConfidentiality` 필드를 만들어놓고 `selectProvider()`가 이 테이블을 조회하지 않습니다.

**결과**: 나중에 AX_TEAM이 관리자 화면에서 "Anthropic도 G3까지 허용"으로 설정을 바꿔도 코드에 박힌 규칙은 그대로라 효과가 없습니다. 카탈로그가 "보여주기용 문서"에 머물고 실제 판단 근거가 되지 못합니다.

**수정**: `selectProvider()`가 `ModelProvider` 테이블을 조회하도록 변경.

---

## 🟠 High — `/api/ai/[provider]/route.ts` 유지 근거 약함

"B트랙 내부엔진이 직접 호출"이라는 이유로 남기는데, `gatewayCompleteRouted()`는 라이브러리 함수 호출입니다. 내부 엔진이 자기 자신의 HTTP API를 또 fetch로 호출할 이유가 없습니다(불필요한 왕복, 성능 손해). `/me/ai` 삭제 시 이 엔드포인트의 유일한 소비자가 없어지는 셈이라, 다른 실제 소비자가 없다면 같이 정리 대상입니다.

---

## 🟡 Medium — 7개 taskType 중 2개만 실제 규칙 보유

`GATE1_REVIEW`, `GATE2_REVIEW`, `KPI_EVAL`, `GENERAL` 4개는 전부 기본값(클라우드)으로 떨어집니다. 특히 Gate2 코드리뷰는 코드 diff가 길어 토큰 비용이 큰 지점인데 이번 범위에서 최적화가 안 됩니다. 착수 범위로는 맞지만, "비용 절감" 목적 대비 커버리지가 좁다는 걸 인지하고 후속 확장 계획이 필요합니다.

---

## 잘된 점

- 기존 4개 어댑터를 건드리지 않고 라우팅 레이어만 얹은 것 — 재사용 원칙 지킴
- G3 규칙을 최우선으로 체크하는 순서 — 우선순위는 맞음
- 단계별 작업시간 추정이 현실적

---

## 다음 액션

| 항목 | 우선순위 |
|---|---|
| `confidentialityLevel` 기본값 G2→G3 변경 | ★★★ 배포 블로커 |
| `score/route.ts`에 confidentialityLevel 전달 추가 | ★★★ 배포 블로커 |
| providerKey/taskType을 이벤트 단위 테이블로 이동 | ★★★ 배포 블로커 |
| `selectProvider()`가 `ModelProvider` 테이블 조회하도록 변경 | ★★ |
| `/api/ai/[provider]/route.ts` 실제 소비자 확인 후 정리 | ★ |
| 나머지 taskType(Gate1/2, KPI) 라우팅 규칙 후속 설계 | ★ |
