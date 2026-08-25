# AX Hub 모델 라우팅 3차 리뷰 — 최종 확정본 검토

**대상**: 1차·2차 리뷰(총 6개 Critical/High) 반영한 최종 확정 설계
**검토일**: 2026-08-21

---

## 결론

이전 지적 3개(costTier 정렬, eligible 빈배열 fallback, costKrw Float)는 정확히 반영됐습니다. 다만 이번 수정 과정에서 **의도와 다르게 동작이 바뀐 지점 2개**를 새로 발견했습니다 — 둘 다 "에러 없이 조용히 반대로 작동"하는, 지난번 `costTier` 버그와 같은 계열의 문제입니다.

---

## 🟠 High — GATE3_RATIONALE이 "품질 우선"이 아니라 "가장 저렴한 클라우드"를 고름

```ts
if (taskType === 'GATE3_RATIONALE') {
  const cloud = eligible.find(p => p.hostType === 'CLOUD')  // costRank 오름차순 정렬된 배열에서 첫 CLOUD
  return (cloud?.providerKey ?? eligible[0].providerKey) as ProviderKey
}
```

`eligible`은 이미 `costRank asc`로 정렬돼 있으므로, 여기서 `find`가 고르는 건 "가장 좋은 클라우드"가 아니라 **"제일 싼 클라우드"**입니다. 현재 시드 데이터로 계산하면:

```
G2 요청 시 eligible 순서: onprem(2) → gemini(3) → openai(4) → anthropic(4)
GATE3_RATIONALE → 첫 CLOUD = gemini
```

**Gate3 근거생성(가장 복잡한 추론이 필요한 작업)이 Anthropic이 아니라 Gemini로 갑니다.** 원래 하드코딩 버전에선 `return 'anthropic'`으로 명시했던 걸, DB 기반으로 바꾸면서 "품질 우선"이 "비용 우선"으로 은근슬쩍 치환됐습니다. 비용 정렬 배열을 재사용한 부작용입니다.

**수정**: `ModelProvider`에 `qualityRank` 같은 별도 필드를 추가하거나, `GATE3_RATIONALE`만큼은 명시적으로 `anthropic`을 우선 시도하고 비활성화 시에만 다음 클라우드로 폴백하는 방식이 필요합니다.

---

## 🟠 High — GATE3_RATIONALE 제외 전 taskType이 전부 온프렘으로 수렴

`onprem`은 `maxConfidentiality='G3'`라 어떤 기밀등급 요청에도 항상 `eligible`에 들어오고, `costRank=2`로 gemini(3)·openai/anthropic(4)보다 항상 낮습니다. 그 결과 `그 외 → eligible[0]` 로직에서 **`TIER1_PARSE`, `GATE1_REVIEW`, `GATE2_REVIEW`, `KPI_EVAL`, `SYNTHESIZE`, `GENERAL` 전부 무조건 온프렘으로만 갑니다.**

원래 하드코딩 버전은 taskType별로 `TIER1_PARSE`=온프렘, 그 외 중간작업=환경변수 기본값(클라우드)으로 나뉘어 있었는데, DB 정렬로 바꾸면서 이 구분이 사라졌습니다. Gate1·Gate2 심사처럼 판단력이 필요한 작업까지 전부 온프렘으로 가는 게 **의도한 설계인지, 정렬 로직의 부작용인지** 확인이 필요합니다. 온프렘 Qwen이 이런 심사 업무를 감당할 만큼 검증됐는지도 별개로 확인해야 합니다.

---

## 🟡 Medium — `AuditLog.actorId` 필드명 확인 필요

```ts
data: { action: 'ROUTING_NO_ELIGIBLE_PROVIDER', target: 'gateway', detail: msg, actorId: 'system' }
```

이전 v23구현 코드리뷰에서 확인한 감사로그는 `actorEmail: "SYSTEM"` 패턴이었습니다. 여기선 `actorId`로 다른 필드명을 씁니다. 실제 스키마 필드명이 다르면 이 insert가 조용히 실패합니다(`.catch(() => {})`로 감싸짐). 다행히 뒤이어 `throw new Error(msg)`가 무조건 실행되므로 **라우팅 실패 자체는 여전히 표면화**됩니다 — 사고의 감사 이력만 안 남습니다. Critical은 아니지만 필드명 확인은 필요합니다.

---

## 🟡 Minor — `estimateCostKrw()` 정확도 미확인

`GatewayCallLog`의 존재 이유가 "Qwen이 얼마나 절감했는지 조회"인데, 추정 단가가 부정확하면 그 조회 결과도 부정확해집니다. 이번 문서에 이 함수의 실제 단가 근거가 없습니다.

---

## 확인됨 — 이전 3개 수정 정확히 반영

| 항목 | 상태 |
|---|---|
| `costRank` 숫자 정렬 | ✅ 정확히 고쳐짐 |
| `eligible` 빈 배열 시 에러 발생 | ✅ 조용한 fallback 제거됨 |
| `costKrw: Decimal` | ✅ 재발했던 Float 문제 다시 고쳐짐 |

---

## 다음 액션

| 항목 | 우선순위 |
|---|---|
| GATE3_RATIONALE이 anthropic으로 가도록 명시적 우선순위 로직 추가 (`qualityRank` 또는 하드코딩 우선시도) | ★★★ 배포 전 검증 필요 |
| Gate1/Gate2/KPI_EVAL이 전부 온프렘으로 가는 게 의도인지 확인 | ★★★ 설계 의도 확인 필요 |
| 온프렘 Qwen이 Gate1/2 심사 업무 품질을 감당하는지 검증 | ★★ (위 항목에 따라 결정) |
| `AuditLog.actorId` 실제 필드명 확인 | ★ |
| `estimateCostKrw()` 단가 정확도 확인 | ★ |

**권장**: 배포 전 "GATE3_RATIONALE은 반드시 Anthropic으로 간다"를 테스트 케이스로 만들어 검증할 것.
