# AX Hub 워크플로우 v11 — Qwen3 온프렘 전환 검토 통합

**작성일**: 2026-08-21
**전제 문서**: v3~v10 설계안

---

## 1. 설계 원칙 (v10에 추가)

10. **신규 AI 호출은 반드시 AI Gateway를 경유한다**: SDK 직접 호출(예: `claude.ts` 싱글턴, `/api/nl-query`의 우회 패턴)을 신규 기능에서 반복하지 않는다. 이래야 향후 프로바이더 전환(Qwen3 온프렘 등)이 결정되든 안 되든, 워크플로우 설계 자체는 재작업이 필요 없다.

---

## 2. 기존 설계와의 연결 확인

| 항목 | 검토 결과 |
|---|---|
| 이슈5 (사용량 배치수집 무의미화) | **이미 해결됨** — v5부터 설계한 `UsageEvent`는 앱 레벨 자체기록 방식이라 OpenAI 조직 API 의존이 없음. `collect-llm-usage.ts`는 폐기하고 `UsageEvent`로 일원화 |
| 이슈4 (JSON 파싱 신뢰성) | **P1(§3 Gate3 채점근거 생성) 설계에 그대로 상속됨** — `EvaluationAgent` 확장이라면 P1도 동일한 JSON 강제 옵션 필요, v9에 누락됐던 부분 |

---

## 3. 신규 이슈

### 이슈6 — `costKrw` 정의가 온프렘에서 깨짐

```
API 종량제(현재 전제): costKrw = tokenUsed × 단가
온프렘(Qwen3): 호출당 한계비용 ≈ 0, 실비용은 GPU 서버 고정비
```

**결정 필요**: (a) amortized 방식(서버비÷월처리량)으로 추정 vs (b) 온프렘 호출은 `costKrw=0`, `tokenUsed`만 기록. 후자가 단순하고, 어차피 서버 고정비는 `UsageEvent` 단위가 아니라 별도 인프라비용으로 관리하는 게 맞아 보입니다.

### 이슈7 — 신규 AI 호출의 Gateway 경유 여부 미명세

v6~v10에서 설계한 Tier1(인테이크 파싱)·AI코드리뷰·비용평가·P1(채점근거) 4개 호출 전부 어느 모듈을 쓸지 명시한 적이 없습니다.

```
확정: 4개 전부 AI Gateway 경유
  - Tier1 인테이크 파싱      → AI Gateway (신규 어댑터 로직 재사용)
  - Gate2 AI 코드리뷰        → AI Gateway
  - Gate3 비용평가           → AI Gateway
  - P1 Gate3 채점근거 생성   → EvaluationAgent 확장 (기존에 이미 Gateway 경유)
```

### 이슈8 — AI 호출 기술적 실패와 GateFail(업무상 반려)이 미구분

```prisma
model Project {
  // ... 기존 필드 유지 ...

  // ▼ 신규: AI 호출 자체 실패 여부 (반려와 구분)
  aiCallErrorAt    DateTime?
  aiCallRetryCount Int       @default(0)
}
```

```
처리 흐름:
  AI 호출 실패(JSON 파싱 실패 등)
    → 1회 자동 재시도
    → 재시도도 실패 → aiCallErrorAt 기록, 수동심사 큐로 이동 (GateFail 아님, status 변경 없음)
    → AX팀이 수동으로 해당 게이트 판정
```

**판단 근거**: GateFail은 "신청 내용이 기준 미달"이고 이건 "시스템이 판단 자체를 못 함"이라 원인이 다릅니다. 같은 경로로 묶으면 신청자에게 억울한 반려로 보일 수 있습니다.

---

## 4. 수정 범위 정리 (원문서 유지 + 확인)

| 작업 | 필수 여부 | 비고 |
|---|---|---|
| OpenAI 어댑터에 `ONPREM_LLM_BASE_URL` 추가 | 필수 | 원안 그대로 |
| `/api/nl-query` AI Gateway 경유로 전환 | 필수 | 원안 그대로 |
| `MODEL` 환경변수화 | 필수 | 원안 그대로 |
| `EvaluationAgent` JSON 강제 옵션 추가 | 필수 | P1 설계에도 동일 적용 필요 (§2) |
| LLM 사용량 수집 방식 전환 | 권장→**필수로 상향** | `UsageEvent` 일원화가 이미 v5부터 설계돼 있어 지금 전환하는 게 이중관리보다 낫습니다 |
| 신규 AI 호출 Gateway 경유 명세 | 신규 항목 | §3 이슈7 |
| AI 호출 에러 vs GateFail 구분 | 신규 항목 | §3 이슈8 |

---

## 5. 우선순위 판단

**Qwen3 전환 자체의 실행 시점은 인표님 판단 영역**입니다(회의 §9 온프렘화 검토와 연결된 인프라 결정). 다만 **"신규 AI 호출은 Gateway 경유"(원칙10)는 전환 여부와 무관하게 지금 확정**하는 게 맞습니다 — 나중에 전환하기로 결정났을 때 워크플로우 재설계가 필요 없어집니다.

middleware.ts(M, 트랙A/P0) 대비 우선순위는 낮습니다 — 인증 우회 위험이 열려있는 상태에서 모델 전환 작업을 먼저 할 이유는 없습니다.

---

## 6. 미결 사항 (v10 대비 갱신)

| 항목 | 내용 |
|---|---|
| Qwen3 전환 실행 시점 | 인표님 판단 필요 |
| costKrw 온프렘 계산 방식 | amortized vs 0-처리 중 결정 필요 |
| `collect-llm-usage.ts` 폐기 시점 | UsageEvent 전환과 동시 진행 여부 |
| ~~middleware.ts GitHub 이슈 등록 여부~~ | v10과 동일 미결, 여전히 최우선 |
| ~~P2/P3 재검토조건, PostgreSQL 전환시점, 이의제기 SLA 등~~ | v9·v10과 동일 미결 |

---

## 7. 변경 이력 (v10 → v11)

| 항목 | v10 상태 | v11 조치 |
|---|---|---|
| Qwen3 온프렘 검토 5건 | 미반영 | 이슈1~3은 원안 그대로 채택(기술적으로 명확), 이슈4·5는 기존 설계와 연결점 확인, 신규 이슈6·7·8 추가 발굴 |
| 사용량 수집 이중화 | `UsageEvent`(v5)와 `collect-llm-usage.ts`(기존 배치)가 병존 | `UsageEvent`로 일원화, 배치수집 폐기 방향 확정 |
| P1(§3 v9) JSON 리스크 | 미언급 | Qwen3 전환 시 `EvaluationAgent` 확장인 P1도 JSON 강제 옵션 필요함을 명시 |
| 신규 AI 호출 구현 경로 | 미명세 | 원칙10 신설 — Tier1/코드리뷰/비용평가/P1 전부 AI Gateway 경유로 확정 |
| AI 호출 실패 처리 | GateFail과 미구분 | `aiCallErrorAt`/`aiCallRetryCount` 필드로 기술적 실패와 업무 반려를 분리 |
