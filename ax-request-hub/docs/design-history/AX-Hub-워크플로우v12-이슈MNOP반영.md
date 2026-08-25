# AX Hub 워크플로우 v12 — 이슈M/N/O/P 반영

**작성일**: 2026-08-21
**전제 문서**: v3~v11 설계안

---

## 1. 이슈M — 이슈K 반영 확인 (변경이력 명시)

v9에서 지적된 `@db.Decimal(10,4)` SQLite 미호환 문제는 v10에서 `Decimal` 타입만 남기고 어노테이션을 제거하는 걸로 정정했고, v11 이후 코드 예시에도 어노테이션 없이 유지되고 있습니다. 다만 v11 변경이력에 이 사실을 명시적으로 적지 않아 혼란을 드렸습니다. 아래 §5에 명시적으로 기록합니다.

---

## 2. 이슈N — AI 호출 실패 재시도 정책 구체화

**실패 유형에 따라 재시도 전략을 분리합니다.**

```prisma
model Project {
  // ... 기존 필드 유지 ...

  aiCallErrorAt     DateTime?
  aiCallErrorType   String?   // TIMEOUT | PARSE_FAILURE
  aiCallRetryCount  Int       @default(0)
}
```

```
재시도 정책:
  TIMEOUT (응답 자체가 안 옴)
    → 2000ms 대기 후 1회 재시도 (즉시 재시도는 서버 부하 재발 가능성 높음)
    → 재실패 시 수동심사 큐

  PARSE_FAILURE (응답은 왔으나 JSON 파싱 실패)
    → 즉시 1회 재시도, 프롬프트에 "반드시 JSON만 응답" 강조문 추가 + response_format 강제
    → 재실패 시 수동심사 큐

공통: aiCallRetryCount 최대값 = 1 (고정값, 향후 튜닝 필요 시 환경변수화)
```

---

## 3. 이슈O — AI Gateway 존재 여부 검증 불가 (확인 요청)

제가 접근 가능한 프로젝트 자료(`package.json`)를 확인한 결과 `dependencies`에 `@anthropic-ai/sdk`만 있고 `openai`, `@google/generative-ai` 등 다른 프로바이더 SDK가 없습니다. 즉 **v11에서 전제했던 "anthropic/openai/gemini 3개 프로바이더 AI Gateway"의 실제 구현을 제 자료로는 확인할 수 없습니다.**

**확인 필요 사항** (인표님 또는 CTO 에이전트 확인):
1. `src/lib/ai-gateway/` 폴더가 실제로 존재하는지
2. `ConsultationAgent`·`EvaluationAgent`가 이 Gateway를 경유하는지, 아니면 `claude.ts` 싱글턴을 직접 쓰는지
3. 만약 Gateway가 아직 없다면 — 이슈7("Tier1 인테이크 파싱 → AI Gateway 신규 설정")은 "기존 걸 재사용"이 아니라 **"Gateway 자체를 새로 만드는 작업"**이 되어 수정 범위 표(v11 §4)의 공수 추정이 완전히 달라집니다.

이 확인 전까지는 v11 §4 수정범위 표의 "필수/권장" 표기를 잠정치로 취급합니다.

---

## 4. 이슈P — `costKrw` 온프렘 처리 방식 확정

**결정: 온프렘 호출은 `costKrw = 0`, `tokenUsed`만 기록합니다.**

**근거**: amortized 방식(서버비÷월처리량)은 호출이 몰리는 시점엔 원가가 낮아지고 한산할 때는 높아지는 왜곡이 생겨, `UsageEvent` 단위 비용 데이터로 쓰기에 오히려 부정확합니다. GPU 서버 고정비는 `UsageEvent`가 아니라 별도 인프라 예산 항목으로 관리하는 게 맞습니다. `tokenUsed`는 그대로 남겨서 사용량 추이·시간대 분석(회의 §7)에는 계속 쓸 수 있습니다.

**결정 주체**: 이건 기술적 회계처리 방식이라 AX팀 내부에서 확정 가능한 영역으로 판단했습니다. 다만 예산 관점에서 이견이 있으실 수 있어 최종 확인 요청드립니다.

---

## 5. 변경 이력 (v11 → v12)

| 항목 | v11 상태 | v12 조치 |
|---|---|---|
| M | 이슈K(Decimal 어노테이션 제거) 반영 여부가 변경이력에 명시 안 됨 | v10에서 이미 반영됐음을 명시적으로 재확인 기록 |
| N | 재시도 정책이 "1회 자동 재시도"로만 서술, 실패유형·간격 미정 | TIMEOUT/PARSE_FAILURE 구분, 대기시간(2000ms) 명시, 재시도 최대 1회 고정값으로 확정 |
| O | ConsultationAgent/EvaluationAgent의 Gateway 경유 여부를 확인 없이 전제 | `package.json` 확인 결과 다중 프로바이더 SDK 미발견 — 검증 불가로 판단, 인표님/CTO 확인 요청으로 전환. 확인 전까지 v11 수정범위 표는 잠정치 |
| P | "0-처리가 단순, 맞아 보인다"는 서술과 미결사항의 "결정 필요"가 불일치 | costKrw=0으로 확정, 결정 근거와 결정주체 명시 |
