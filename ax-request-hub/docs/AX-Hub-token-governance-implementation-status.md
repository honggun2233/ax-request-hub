# AX Hub — 토큰 거버넌스 3트랙 구현 현황

> 기준일: 2026-08-26  
> 최신 커밋: `c19ae3d`  
> 브랜치: `master` → `origin/master` 동기화 완료

---

## 1. 프로젝트 개요

AX Hub에 AI 비용을 3개 트랙으로 나눠 측정·관제하는 토큰 거버넌스 체계를 구현한다.

| 트랙 | 대상 | 수집 방식 | 저장 모델 |
|---|---|---|---|
| A-Track | 전 직원 Enterprise 라이선스 사용량 | Enterprise Analytics API Pull | `UsageRecordDaily` |
| B-Track | AX Hub 엔진 내부 AI 호출 | Push (호출 시 즉시 기록) | `GatewayCallLog` |
| C-Track | 배포된 에이전트 런타임 호출 | ServiceToken 자기보고 | `AgentRuntimeUsage` |

---

## 2. GAP 해소 현황

원본 분석: `docs/workflow-diagram-v3.html` (GAP 7개 식별)

| GAP | 내용 | 상태 | 커밋 |
|---|---|---|---|
| G-1 | AI-native 에이전트 등록 신청 UI | ✅ 완료 | `5600682` |
| G-2 | Gate 심사 화면 Qwen 추천 벤더 패널 | ✅ 완료 | `aa08842` |
| G-3 | middleware.ts ServiceToken 인증 분기 | ✅ 완료 | `e415fb7` |
| G-4 | ServiceToken 발급·관리 API | ✅ 완료 | `e415fb7` |
| G-5 | A-Track Enterprise API 수집 스크립트 | 🔴 차단 | — |
| G-6 | GatewayCallLog B-Track 자동 기록 | ✅ 완료 | `75a56f1` |
| G-7 | A+B+C 통합 비용 대시보드 | ✅ 완료 | `c19ae3d` |

> **G-5 차단 이유**: Claude Enterprise Analytics API Primary Owner 키 미발급. 콘솔(console.anthropic.com) → Organization → API Keys에서 발급 후 `.env`에 `CLAUDE_ENTERPRISE_API_KEY` 세팅하면 착수 가능.

---

## 3. 신규 파일 목록

### 3-1. API 엔드포인트

| 경로 | 메서드 | 설명 |
|---|---|---|
| `app/api/intake/synthesize/route.ts` | POST | multipart/form-data 업로드 → Qwen 분류 → AI 필드 자동 추출 |
| `app/api/internal/usage/route.ts` | POST | C-Track: ServiceToken Bearer 인증 → `AgentRuntimeUsage` 기록 |
| `app/api/admin/service-tokens/route.ts` | GET/POST/PATCH | ServiceToken 목록·발급·활성화 (AX_TEAM 전용) |
| `app/api/registry/[id]/qwen-classify/route.ts` | GET/PATCH | Qwen 벤더 분류 실행 + override 저장 |
| `app/api/admin/cost-dashboard/route.ts` | GET | A/B/C 3트랙 집계 (`?from=&to=`) |

### 3-2. UI 페이지

| 경로 | 설명 |
|---|---|
| `app/projects/new/page.tsx` | 4단계 상태머신: idle→analyzing→review→submitting |
| `app/admin/cost-dashboard/page.tsx` | A/B/C 통합 비용 대시보드 (AX_TEAM 전용) |

### 3-3. 라이브러리

| 경로 | 설명 |
|---|---|
| `middleware.ts` | Edge-safe 인증 분기: `/api/internal/*`→Bearer, 그 외→NextAuth |
| `lib/service-auth.ts` | `verifyServiceToken()` — sha256 해시 검증 + lastUsedAt 갱신 |
| `src/lib/agent-registry-link.ts` | `linkAgentToRegistry()` — Agent↔AgentRegistry 자동 연결 |
| `src/lib/ai-gateway/routing.ts` | `classifyTask()` (Qwen 분류) + `gatewayCompleteRouted()` (자동 라우팅 + B-Track 로그) |

### 3-4. 수정 파일

| 경로 | 변경 내용 |
|---|---|
| `prisma/schema.prisma` | `ServiceToken`, `AgentRuntimeUsage`, `GatewayCallLog`, `ModelProvider` 모델 추가; `AgentRegistry`에 `recommendedProvider`, `providerOverride` 필드 추가 |
| `src/lib/agents/evaluation.ts` | `gatewayComplete` → `gatewayCompleteRouted` (taskType: `GATE2_REVIEW`) |
| `src/lib/agents/consultation.ts` | `gatewayComplete` → `gatewayCompleteRouted` (start: `SYNTHESIZE`, continueChat: `GATE3_RATIONALE`) |
| `app/api/registry/route.ts` | ACTIVE 전환 시 `linkAgentToRegistry` 자동 호출 |
| `app/api/intake/parse/route.ts` | `usageEvent` → `gatewayCallLog` 기록으로 교체 |
| `app/api/registry/[id]/runtime-usage/route.ts` | `Decimal + number` 타입 오류 수정 |
| `src/lib/ai-gateway/adapters/bedrock.ts` | `ProviderKey` 타입 명시 (`onprem`) |
| `components/Sidebar.tsx` | '비용 관리 > AI 비용 통합' 메뉴 추가 |
| `app/registry/page.tsx` | `QwenRecommendPanel` 컴포넌트 추가 (Gate 심사 SlideOver) |

---

## 4. 주요 아키텍처 결정

### AI 게이트웨이 최종 구조
```
요청 → classifyTask(Qwen on-prem) → 벤더 분류
      → gatewayComplete(Bedrock) → 실제 실행
      → GatewayCallLog.create() → B-Track 기록
```

- Qwen = 판단 전용 (분류·평가), Bedrock = 실행 전용
- `gatewayCompleteRouted()` 하나로 분류+실행+로그 통합

### ServiceToken 인증 흐름
```
배포 에이전트 → Bearer <rawToken>
middleware.ts → Bearer 존재 확인만 (Edge Runtime, Prisma 불가)
route handler → verifyServiceToken(rawToken) → sha256 해시 비교
               → AgentRuntimeUsage.create()
```

### Prisma generate 우회 (DLL 잠금)
dev server 가동 중 스키마 변경 시:
```bash
npx prisma db push --skip-generate     # DB 적용
PRISMA_GENERATE_NO_ENGINE=1 npx prisma generate  # 클라이언트 재생성
```

---

## 5. 미완료 / 다음 단계

| 항목 | 우선순위 | 조건 |
|---|---|---|
| G-5 A-Track 수집 스크립트 | 높음 | Claude Enterprise Analytics API 키 발급 후 |
| ServiceToken UI (토큰 발급 화면) | 중간 | `/admin/tokens` 페이지에 통합 예정 |
| A-Track 자동 배치 (daily cron) | 낮음 | G-5 완료 후 |

---

## 6. 로컬 실행

```bash
cd C:\project\ax-team\ax-request-hub
PORT=3005 npm run dev
```

접속: http://localhost:3005  
AI 비용 대시보드: http://localhost:3005/admin/cost-dashboard  
에이전트 레지스트리: http://localhost:3005/registry
