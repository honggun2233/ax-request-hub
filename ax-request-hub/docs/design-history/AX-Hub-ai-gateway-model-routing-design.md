# AX Hub — AI Gateway 모델 라우팅 설계안

**작성일**: 2026-08-21
**배경**: Mulesoft 벤치마킹에서 나온 "프롬프트 내용 기반 모델 자동 라우팅" 개념 도입 검토. 기존 AI Gateway(anthropic/openai/gemini/onprem 4개 어댑터) 위에 판단 레이어를 얹는 방식으로 설계.

---

## 1. 설계 원칙

1. **분류 자체가 비용을 추가하면 안 된다**: 라우팅 판단에 비싼 LLM 호출을 쓰면 비용 절감이라는 목적이 무색해진다. 규칙 기반 → 경량 임베딩 순으로, LLM 재호출은 최후 수단으로만 둔다.
2. **AI가 판단하고 사람은 원클릭 override 한다**: 인테이크 재설계에서 정립한 "판단+확인" 패턴을 그대로 적용한다. 라우팅 결과를 강제하지 않고 항상 되돌릴 수 있게 한다.
3. **라우팅 근거는 항상 기록한다**: 왜 이 모델로 갔는지 설명 가능해야 하고, 사람이 override한 이력은 향후 룰 튜닝의 데이터가 된다.
4. **A트랙부터 적용한다**: `/me/ai`(직원 직접 채팅)가 비용 문제와 가장 직결되고 효과가 즉시 체감된다. B/C트랙은 후속 검토.

---

## 2. 라우팅 판단 아키텍처 — 2단계

```mermaid
flowchart TD
    Input[사용자 프롬프트 입력] --> Tier0{Tier0: 규칙 기반<br/>키워드·길이·패턴}
    Tier0 -->|명확히 분류됨| Suggest[추천 모델 확정]
    Tier0 -->|애매함| Tier1{Tier1: 경량 임베딩 유사도<br/>사전정의 카테고리와 비교}
    Tier1 --> Suggest

    Suggest --> Confirm[사용자에게 표시<br/>"자동추천: Qwen 온프렘 (신뢰도 82%)"]
    Confirm -->|그대로 진행| Route[해당 프로바이더로 라우팅]
    Confirm -->|원클릭 override| ManualRoute[사용자가 다른 프로바이더 직접 선택]

    Route --> Log[RoutingDecision 기록<br/>+ UsageEvent 연결]
    ManualRoute --> Log
```

**Tier2(모델에게 직접 "이 질문이 복잡한가" 되묻는 방식)는 이번 설계에 포함하지 않습니다** — 그 자체가 추가 LLM 호출이라 원칙1을 어깁니다. Tier0·Tier1로 커버 안 되는 경우는 기본값(중간 성능 모델)으로 보내고 사용자 override에 맡깁니다.

---

## 3. 분류 카테고리 (초안)

| 카테고리 | 판단 근거 예시 | 추천 프로바이더 |
|---|---|---|
| SIMPLE_QA | 짧은 질문, 요약·번역 키워드 | onprem Qwen |
| DATA_ANALYSIS | 숫자·표·엑셀 언급 | 중간 성능 모델 |
| CODE_GENERATION | 코드블록·프로그래밍 키워드 | 상위 모델(Claude) |
| COMPLEX_REASONING | 긴 프롬프트, 다단계 추론 요구 문구 | 상위 모델(Claude) |
| CREATIVE_WRITING | 문서·기획서 작성 요청 | 중상위 모델 |

이 카테고리·기준은 초안이며, 실제 운영 데이터(사용자 override 빈도)를 보고 조정합니다.

---

## 4. UX 설계

```
[Before] 프로바이더 수동 선택 드롭다운 (anthropic/openai/gemini/onprem)

[After]
  기본: "자동 추천" 토글 ON
  응답 위 배지: "이 응답은 Qwen 온프렘으로 처리됐습니다 (단순 질의로 판단, 신뢰도 82%)
                [다른 모델로 다시 시도]"
  사용자가 override → 즉시 재실행 + override 이력 기록
```

override가 잦은 카테고리는 분류 기준이 잘못됐다는 신호이므로, 이 데이터를 주기적으로 검토해 Tier0/Tier1 기준을 조정합니다.

---

## 5. DB 스키마

```prisma
model RoutingDecision {
  id                String   @id @default(cuid())
  usageEventId      String?  @unique  // 실행 후 실제 UsageEvent와 연결
  inputPreview      String            // 프롬프트 일부 (민감정보 마스킹 필요 — §7 미결사항)
  classifiedAs      String            // SIMPLE_QA | DATA_ANALYSIS | CODE_GENERATION | COMPLEX_REASONING | CREATIVE_WRITING
  suggestedProvider String            // anthropic | openai | gemini | onprem
  confidence        Float
  userOverrode      Boolean  @default(false)
  finalProvider     String            // 실제 사용된 프로바이더 (override 반영값)
  createdAt         DateTime @default(now())

  @@index([classifiedAs, userOverrode])  // 튜닝 시 "어느 카테고리가 자주 override 되는지" 조회용
}
```

`UsageEvent`에 `routingDecisionId String?` 필드를 추가해 실제 소비된 토큰·비용과 라우팅 판단을 연결합니다.

---

## 6. API 설계

```
POST /api/ai-gateway/route-decide
  body: { promptPreview: string }
  response: { classifiedAs, suggestedProvider, confidence }

POST /api/ai/[provider]
  provider = "auto"일 경우:
    1. route-decide 호출
    2. 반환된 suggestedProvider로 실제 어댑터 위임
    3. RoutingDecision 레코드 생성
  provider가 특정값(anthropic 등)이면: 기존과 동일하게 즉시 해당 어댑터로 (수동 선택 = override)
```

---

## 7. 미결 사항

| 항목 | 내용 |
|---|---|
| `inputPreview` 마스킹 방식 | 프롬프트 원문 일부를 저장하는 것이라 민감정보(고객정보·기밀데이터) 마스킹 필요 여부 확인 |
| 카테고리·기준 튜닝 주기 | override 데이터를 얼마나 자주 검토해서 기준을 바꿀지 |
| B/C트랙 적용 여부 | B트랙은 이미 대부분 고정 프롬프트라 라우팅 이득이 적을 수 있음 — 재검토 필요 |
| 기본값(애매한 경우 보낼 모델) | 지금은 "중간 성능 모델"로만 정함, 구체적 모델 확정 필요 |

---

## 8. 롤아웃 순서

| 순서 | 대상 | 사유 |
|---|---|---|
| 1 | A트랙(`/me/ai`) | 비용 문제와 직결, 효과 즉시 체감 |
| 2 | B트랙(AX Hub 자체 인테이크·코드리뷰·채점) | 작업 성격이 이미 어느정도 정해져 있어 이득이 상대적으로 작을 수 있음, 온프렘 부하분산 관점에서만 검토 |
| 3 | C트랙(배포된 에이전트) | 우선순위 낮음 — 이미 빌드 시점에 모델이 정해지는 구조라 실시간 재라우팅 이득 작음 |

---

## 9. 판단 요약

기존 AI Gateway 구조(4개 어댑터)를 재사용하는 확장이라 신규 인프라 구축이 아닙니다. 핵심은 "판단 로직을 얼마나 저비용으로 유지하느냐"이고, 이번 설계는 규칙기반+임베딩까지만 쓰고 LLM 재호출(Tier2)은 배제해 이 원칙을 지켰습니다. A트랙부터 적용해 효과를 검증한 뒤 B/C트랙 확장 여부를 결정하는 게 순서상 맞습니다.
