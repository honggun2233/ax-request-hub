# C-트랙 Policy Gateway 연결 — 현황 조사 및 옵션 견적

> 작성: 2026-09-04 | 조사 시점: 2026-09-03 코드 실측
> 구현 지시 전 인표님 검토 후 별도 티켓으로 진행

---

## 1. 현재 C-트랙 에이전트 사용량 보고 경로 (조사 완료)

실제 경로: `POST /api/internal/usage`

```
ETF봇/DMS봇 (외부 에이전트)
  │
  ├─ AI 호출 ──────────────→ Claude/GPT 등 외부 AI 벤더 (AX Hub 미경유)
  │
  └─ 사용량 보고 ──────────→ POST /api/internal/usage
                              Authorization: Bearer <serviceToken>
                              { agentKey, providerKey, inputTokens, outputTokens, costKrw }
                                  │
                                  └─ verifyServiceToken() → AgentRuntimeUsage 기록
```

참조 파일: `app/api/internal/usage/route.ts`, `lib/service-auth.ts`

---

## 2. ServiceToken 검증 방식 (조사 완료)

**요청 단위 실시간 검증** (배치 아님).

`verifyServiceToken(rawToken)`이 각 요청 핸들러에서 Bearer 토큰을 sha256 해시 후 DB 조회.
유효성(isActive, expiresAt) 확인 → lastUsedAt 갱신.

즉 서비스 토큰 인증 레이어는 이미 요청 단위로 작동 중. 여기에 Policy Gateway 판정을 끼워넣는 것이 구조적으로 가능함.

---

## 3. 옵션 A·B 실행 난이도 견적

### Option A — 현행 유지 (사후 보고 + 사후 감사만)

**변경 사항**: 없음

**현행 통제 수단**:
- AgentRuntimeUsage 누적 → 관리자 대시보드 월간 집계
- 이상 사용량 시 수동 감사 (AX_TEAM)

**한계**:
- 정책 위반(RETIRED 에이전트, AUTO_BLOCKED 사용자)은 사후에야 감지됨
- 실시간 차단 불가

**견적**: 0 공수. 현재 상태 유지.

---

### Option B — AX Hub 프록시 전환 (실시간 Policy Gateway 적용)

**개요**: C-트랙 에이전트가 AI API를 직접 호출하는 대신, AX Hub의 새 프록시 엔드포인트(`POST /api/gateway/invoke`)를 경유. 서비스 토큰 인증 + Policy Gateway 판정 후 AI 호출 대리.

**신규 구현 항목**:

| 항목 | 공수 |
|---|---|
| `POST /api/gateway/invoke` 신규 엔드포인트 (서비스 토큰 인증 + checkPolicy + AI 프록시) | 중 (1~2일) |
| 각 AI 어댑터(Claude/GPT/Gemini) 프록시 로직 (스트리밍 포함 시 복잡도 상승) | 중~대 (2~4일, 스트리밍 여부에 따라) |
| `AgentRegistry.agentKey`로 agentId 조회 (서비스 토큰의 agentKey 활용) | 소 (0.5일) |
| 기존 C-트랙 에이전트 코드 수정 (AI 직접 호출 → AX Hub 경유로 전환) | 에이전트 수에 비례 (ETF봇·DMS봇 등 각 0.5~1일) |
| 이관 테스트 (기능 동등성 검증) | 소~중 (1~2일) |

**총 견적**: 약 5~10일 (에이전트 수·스트리밍 복잡도에 따라 변동)

**선결 조건**:
- AX Hub 서버 가용성·응답속도가 C-트랙 에이전트 SLA에 영향을 미치지 않는 것 확인
- AI 어댑터 API 키를 AX Hub 서버에서 관리 (현재 각 에이전트가 직접 보유)

**장점**:
- 정책 위반 실시간 차단 (RETIRED/AUTO_BLOCKED 즉시 막힘)
- AI API 키 중앙 관리

---

## 결론 및 권고

| 기준 | Option A | Option B |
|---|---|---|
| 공수 | 0 | 5~10일 |
| 실시간 통제 | 불가 | 가능 |
| 운영 단순성 | 높음 | AX Hub 단일 장애점 추가 |
| AI API 키 관리 | 분산 | 중앙화 |

현재 C-트랙 에이전트 수가 적고(ETF봇·DMS봇 등 소수), 위반 빈도가 낮은 초기 단계라면 **Option A 유지 후 에이전트 수 증가 시 B 전환** 검토 권고.
