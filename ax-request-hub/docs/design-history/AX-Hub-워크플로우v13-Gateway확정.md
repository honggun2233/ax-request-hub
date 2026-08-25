# AX Hub 워크플로우 v13 — Gateway 확정 + 이슈R/S 반영

**작성일**: 2026-08-21
**전제 문서**: v3~v12 설계안

---

## 1. 이슈Q — AI Gateway 존재 확정 (v12 정정)

코드 실물 확인 결과, `src/lib/ai-gateway/`가 이미 존재합니다.

```
src/lib/ai-gateway/
  types.ts       — ProviderKey: 'anthropic' | 'openai' | 'gemini'
  registry.ts    — 3개 어댑터 등록
  adapters/
    anthropic.ts
    openai.ts    — raw fetch 사용 (SDK 미설치, package.json에 안 잡히는 이유)
    gemini.ts
    base.ts
  quota.ts
```

OpenAI·Gemini 어댑터가 SDK 대신 raw fetch를 쓰기 때문에 v12에서 "SDK 미발견 → 검증 불가"로 판단한 게 잘못된 추론이었습니다. `ConsultationAgent`·`EvaluationAgent`도 Gateway 경유가 확인됐습니다.

**조치**: v11 §4 수정범위 표의 "잠정치" 유보를 해제합니다. 원안(v9 원문서) 그대로 확정:

| 작업 | 필수 여부 |
|---|---|
| OpenAI 어댑터에 `ONPREM_LLM_BASE_URL` 추가 | 필수 (기존 어댑터 수정, 신규 구축 아님) |
| `/api/nl-query` AI Gateway 경유로 전환 | 필수 |
| `MODEL` 환경변수화 | 필수 |
| `EvaluationAgent` JSON 강제 옵션 추가 | 필수 |
| 신규 AI 호출(Tier1·코드리뷰·비용평가·P1) Gateway 경유 | **"기존 Gateway 재사용"으로 확정** — 신규 Gateway 구축이 아니므로 공수 추정 하향 |

---

## 2. 이슈R — v10 존재 재확인

v10(`AX-Hub-워크플로우v10-Decimal정정-보안승격-이의제기정책.md`)은 실제로 작성되어 있고, `@db.Decimal(10,4)` 어노테이션 제거를 §1에서 다뤘습니다. 파일이 안 열리셨다면 v11 때와 같은 파일명 인코딩 문제로 추정되어 재전송했습니다. "v10 미검토"가 아니라 "v10 확인 필요" 상태였던 것으로 정리합니다.

---

## 3. 이슈S — `aiCallErrorType`에 `CONTEXT_EXCEEDED` 예약

```prisma
model Project {
  // ... 기존 필드 유지 ...

  aiCallErrorType   String?   // TIMEOUT | PARSE_FAILURE | CONTEXT_EXCEEDED (예약, 미구현)
}
```

**처리 방식 (예약만, 지금 구현 안 함)**: `CONTEXT_EXCEEDED`는 TIMEOUT/PARSE_FAILURE처럼 단순 재시도로 해결되지 않고 **파일 청크 분할**이 필요합니다. Qwen3 온프렘 전환(v11) 시 Gate2 AI 코드리뷰에 긴 파일이 들어올 때 실제로 발생할 수 있는 케이스라 지금 값만 예약해두고, 청크 분할 로직은 Qwen3 전환이 실제 결정될 때 설계합니다.

---

## 4. 미결 사항 (v12 대비 갱신)

| 항목 | 내용 |
|---|---|
| CONTEXT_EXCEEDED 청크분할 로직 | Qwen3 전환 결정 시점에 별도 설계 |
| ~~AI Gateway 존재 여부~~ | **해결됨 — 확인 완료** |
| ~~middleware.ts GitHub 이슈 등록 여부~~ | 여전히 최우선 미결 |
| ~~Qwen3 전환 실행시점, costKrw 인프라예산 확인, P2/P3 재검토조건 등~~ | v9~v12와 동일 미결 |

---

## 5. 변경 이력 (v12 → v13)

| 항목 | v12 상태 | v13 조치 |
|---|---|---|
| Q | Gateway 존재를 "검증 불가"로 판단, 확인 요청으로 전환 | 코드 실물 확인 결과 존재 확정. raw fetch 기반이라 SDK 미설치로 package.json에 안 잡혔던 것으로 원인 규명. 수정범위 표 잠정치 해제 |
| R | v10에서 이슈K가 반영됐다고 서술만 함 | v10 파일 실존 재확인, 재전송으로 접근성 문제 해소 |
| S | `aiCallErrorType`이 TIMEOUT/PARSE_FAILURE 2종만 정의 | `CONTEXT_EXCEEDED` 예약값 추가 (구현은 Qwen3 전환 결정 이후) |
