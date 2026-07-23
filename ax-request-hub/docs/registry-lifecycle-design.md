# AX Hub 에이전트 레지스트리 — 설계 문서

작성일: 2026-07-14 (초안) / 2026-07-15 (M:N 구조 반영 개정)  
목적: `/registry` 페이지의 라이프사이클 + 프로젝트-에이전트 M:N 구조 설계 기록

---

## 1. 핵심 개념 — 에이전트 ↔ 프로젝트 M:N

에이전트는 **재사용 가능한 자산**, 프로젝트는 **업무 맥락**이다.  
하나의 에이전트가 여러 프로젝트에 참여할 수 있고, 하나의 프로젝트에 여러 에이전트가 붙는다.

```
AXProject (5개)          AgentRegistry (27개+)
─────────────            ──────────────────────
ETF SAM LAB   ──M:N──── MomentumAgent (GATE2)
DMS                      ThematicAgent (GATE2)
IT 예산관리               ComplianceSignalAgent (ACTIVE)
업무효율화                DMS-Classifier (GATE3)
AX Hub 내부              ...
```

**AgentProjectLink 필드:**
- `agentId` — AgentRegistry FK
- `projectId` — AXProject FK
- `role` — PRIMARY / SUPPORTING / EXPERIMENTAL
- `addedAt` — 연결 일시

---

## 2. AXProject 등록 현황 (2026-07-15 기준)

| key | name | domain | 설명 |
|-----|------|--------|------|
| etf-samlab | ETF SAM LAB | ETF | 가상 ETF 운용 시뮬레이션 플랫폼 앙상블 에이전트 |
| dms | DMS 문서관리 | 운영 | 사내 문서 자동 분류·검색 AI |
| it-budget | IT 예산관리 | 운영 | IT 예산 편성·집행 모니터링 AI |
| bizops | 업무효율화 | 효율화 | STT 회의록·공시 보고서 자동화 |
| ax-hub | AX Hub 내부 | 거버넌스 | 과제 자동 평가·AI 리터러시 코칭 |

---

## 3. 라이프사이클 단계 정의

```
DEVELOPING → GATE1 → GATE2 → GATE3 → ACTIVE → DEGRADED → RETIRED
```

| 단계 | 의미 | 통과 기준 | 담당 |
|------|------|-----------|------|
| DEVELOPING | 코드 작성 중, QA 미제출 | 코드 PR 머지 | CTO |
| GATE1 | 기능 검증 | fallback율 ≤ 30%, 정상 AgentSignal 반환 | QA |
| GATE2 | 도메인 검증 | SAM LAB 30일 정확도 ≥ 55%, 운용역 신뢰점수 ≥ 3/5 | 운용역 |
| GATE3 | 스트레스 검증 | 데이터 없음/이상값 시 크래시 0, fallback 정상 | QA |
| ACTIVE | 운영 중 | 3 Gate 모두 통과 | — |
| DEGRADED | 성능 저하 | 정확도 < 50% 또는 fallback율 > 70% 2주 연속 | 자동 감지 |
| RETIRED | 폐기 | 운용역/CTO 합의 후 수동 처리 | 운용역 |

---

## 4. 페이지 구성 — 듀얼 뷰

### 4-1. 공통 헤더

```
에이전트 레지스트리                    총 27개 | 활성 N개    [에이전트 뷰] [프로젝트 뷰]
전사 AI 에이전트 라이프사이클 관리 — DEVELOPING → GATE1 → GATE2 → GATE3 → ACTIVE
```

### 4-2. 에이전트 뷰

```
┌───────────────────────────────────────────────────────────────────────┐
│  라이프사이클 단계 (클릭 → 필터)                                        │
│  [DEV:0] → [GATE1:N] → [GATE2:N ⚠] → [GATE3:N] → [ACTIVE:N] → ...  │
└───────────────────────────────────────────────────────────────────────┘
단계 선택 시 → 액션 배너 (무엇을 해야 하는지 안내)

에이전트 카드 그리드
  ┌──────────────────────────┐
  │ MomentumAgent   [GATE2]  │
  │ 가격 모멘텀 분석          │
  │ [ETF SAM LAB]            │  ← 소속 프로젝트 태그
  │ G1✓ G2– G3–              │  ← Gate 진행도
  │ Fallback율 ████░ 82%     │
  └──────────────────────────┘
카드 클릭 → 슬라이드오버
```

### 4-3. 프로젝트 뷰

```
ETF SAM LAB (19개)  [운영 1 · Gate2 11 · Gate1 6 · 개발중 1]   ▲
  ├── ComplianceSignalAgent  주에이전트  ✓G1 ✓G2 ✓G3  [ACTIVE]
  ├── MomentumAgent          주에이전트  ✓G1 –G2 –G3  [GATE2]
  └── ...

DMS 문서관리 (2개)  [Gate3 1 · ACTIVE 1]                        ▲
  ├── DMS-Classifier         주에이전트  ✓G1 ✓G2 –G3  [GATE3]
  └── DMS-SearchAssist       주에이전트  ✓G1 ✓G2 ✓G3  [ACTIVE]
```

### 4-4. 슬라이드오버 (카드 클릭 시)

```
 AgentName             [닫기 ×]
 에이전트 목적 설명

 소속 프로젝트          [+ 연결]
  [ETF SAM LAB  주에이전트  ✕]
  → 연결 추가 시 프로젝트 선택 + 역할 선택

 Gate 진행도
  Gate1 ✓ 통과 (2026-07-14)  fallback율 ≤ 30%, AgentSignal 정상
  Gate2 ○ 대기 중            30일 정확도 ≥ 55%, 신뢰점수 ≥ 3
  Gate3 ○ 미시작

 운용역 리뷰 태깅 (GATE2 단계에서만 표시)
  신뢰점수 [1][2][3][4][5]
  코멘트 ____________________

 주요 지표
  데이터소스 / 실데이터 연결 / Fallback율 / 30일 정확도 / 최근 Score

 [→ GATE2로 진행] 또는 [✓ ACTIVE 전환] 등 다음 단계 버튼
 [폐기 처리 (RETIRED)]
```

---

## 5. DB 스키마 (AgentRegistry 핵심 필드)

```prisma
model AgentRegistry {
  id                String   @id @default(cuid())
  agentName         String   @unique
  agentKey          String   @unique
  version           String   @default("1.0.0")
  purpose           String
  dataSource        String
  owner             String   @default("CTO")
  status            String   @default("active")
  realDataConnected Boolean  @default(false)
  fallbackRate      Float    @default(1.0)
  gate1Passed       Boolean  @default(false)
  gate2Passed       Boolean  @default(false)
  gate3Passed       Boolean  @default(false)
  lifecycleStage    String   @default("GATE1")
  gate1PassedAt     DateTime?
  gate2PassedAt     DateTime?
  gate3PassedAt     DateTime?
  operatorTrustScore Int?
  operatorComment   String?
  sam30dAccuracy    Float?
  degradedSince     DateTime?
  retiredAt         DateTime?
  retireReason      String?
  scores            AgentScore[]
  projects          AgentProjectLink[]  // M:N 프로젝트 연결
}

model AXProject {
  id          String   @id @default(cuid())
  key         String   @unique   // "etf-samlab"
  name        String             // "ETF SAM LAB"
  domain      String             // "ETF" | "운영" | "효율화" | "거버넌스"
  description String
  owner       String
  status      String   @default("ACTIVE")
  agents      AgentProjectLink[]
}

model AgentProjectLink {
  id        String        @id @default(cuid())
  agentId   String
  agent     AgentRegistry @relation(...)
  projectId String
  project   AXProject     @relation(...)
  role      String        @default("PRIMARY")  // PRIMARY | SUPPORTING | EXPERIMENTAL
  addedAt   DateTime      @default(now())
  @@unique([agentId, projectId])
}
```

---

## 6. API 엔드포인트

| Route | Method | 용도 |
|-------|--------|------|
| `/api/registry` | GET | 전체 에이전트 목록 + 단계별 카운트 + 소속 프로젝트 |
| `/api/registry` | PATCH | 라이프사이클 단계 전환 + 신뢰점수 저장 |
| `/api/registry/links` | POST | 에이전트-프로젝트 연결 추가 |
| `/api/registry/links` | DELETE | 에이전트-프로젝트 연결 해제 |
| `/api/ax-projects` | GET | AXProject 목록 + 연결 에이전트 포함 조회 |

---

## 7. 설계 원칙

1. **에이전트 = 재사용 자산** — 하나의 에이전트가 여러 프로젝트에 참여 가능
2. **프로젝트 = 맥락** — "어느 업무에 붙어 있는가"를 추적하기 위한 단위
3. **액션 중심 UI** — 단계별로 "지금 무엇을 해야 하는가"를 배너로 명시
4. **병목 가시화** — 파이프라인 바에서 단계별 에이전트 수 한눈에 파악
5. **이원 뷰** — 에이전트 자산 관리(재사용)와 프로젝트별 현황 파악을 동시에 지원

---

## 8. 통합 상태 전이표 (P2-2)

> 갱신: 2026-07-23  
> AX Hub는 세 개의 독립적인 상태 체계를 운용한다. 아래 표는 각 체계의 상태값과 전환 조건을 통합하여 정리한다.

### 8-1. 세 상태 체계 매핑

| 체계 | 필드 | 모델 | 상태값 |
|------|------|------|--------|
| **과제 플로우** | `Project.status` | Project | submitted → evaluated → pilot → production → closed |
| **에이전트 운영 상태** | `Agent.status` | Agent (레거시) | ACTIVE → DEPRECATED → RETIRED |
| **레지스트리 Gate** | `AgentRegistry.lifecycleStage` | AgentRegistry | DEVELOPING → GATE1 → GATE2 → GATE3 → ACTIVE → DEGRADED → RETIRED |

### 8-2. 과제 플로우 상태 전이

```
submitted ──→ evaluated ──→ pilot ──→ production ──→ closed
    │               │           │
    │               │           └── 30일 + Gate2 통과 → ACTIVE 전환
    │               └── 자동 스코어링 또는 AX팀 수동 평가
    └── 신청 접수 (GET /submit)
```

| 전환 | 트리거 | 조건 | 담당 |
|------|--------|------|------|
| submitted → evaluated | `/api/evaluate/[id]` POST | 자동 스코어링 완료 | AX팀 또는 자동 |
| evaluated → pilot | `/api/approve/[id]` POST (action: approve) | AX팀/C_LEVEL 승인 | AX팀 |
| evaluated → closed | `/api/approve/[id]` POST (action: reject) | AX팀/C_LEVEL 반려 | AX팀 |
| pilot → production | 수동 전환 | **30일 누적 운용 + Gate2 리뷰 통과** (아래 §8-4 참조) | 운용역 + AX팀 |
| production → closed | 수동 전환 | KPI 3개월 60% 미달 또는 정책 변경 | AX팀 |

### 8-3. 에이전트 운영 상태 전이 (Agent 모델)

```
ACTIVE ──→ DEPRECATED ──→ RETIRED
               │
               └── (성과 미달·중복·정책변경)
```

| 전환 | 트리거 | 조건 | 담당 |
|------|--------|------|------|
| ACTIVE → DEPRECATED | `/api/agents/[id]/deprecate` POST | 폐기 사유 입력 필수 (DUPLICATE/PERFORMANCE/POLICY_CHANGE/SCOPE_CHANGE/OTHER) | AX팀 |
| DEPRECATED → RETIRED | `/api/agents/[id]/retire` POST | DEPRECATED 상태 + 지식 추출 완료 권장 | AX팀/C_LEVEL |

### 8-4. 레지스트리 Gate 라이프사이클 (AgentRegistry 모델)

```
DEVELOPING → GATE1 → GATE2 → GATE3 → ACTIVE
                                          │
                                     DEGRADED ──→ RETIRED
```

| 전환 | Gate 통과 기준 | 담당 |
|------|---------------|------|
| → GATE1 | PR 머지 + QA 제출 완료 | CTO |
| → GATE2 | fallback율 ≤ 30%, AgentSignal 정상 반환 | QA |
| → GATE3 | SAM LAB 30일 정확도 ≥ 55%, 운용역 신뢰점수 ≥ 3/5 | 운용역 |
| → ACTIVE | 데이터 없음/이상값 시 크래시 0, fallback 정상 | QA |
| ACTIVE → DEGRADED | 정확도 < 50% 또는 fallback율 > 70% — 2주 연속 | 자동 감지 |
| → RETIRED | 운용역/CTO 합의 후 수동 처리 | 운용역 |

### 8-5. pilot → ACTIVE(production) 졸업 기준 명문화

**조건 1: 30일 누적 운용**  
- `pilot` 상태 진입일로부터 30 calendar day 이상 경과  
- 해당 기간 내 심각(Critical) 버그 0건, 롤백 0회

**조건 2: 운용역 Gate2 리뷰 통과**  
- `AgentRegistry.lifecycleStage == GATE2` 상태의 연결 에이전트에 대해  
- 운용역이 신뢰점수 ≥ 3/5 평가 + `gate2Passed = true` 기록  
- `operatorTrustScore`, `sam30dAccuracy` 필드에 수치 입력 필수

**졸업 프로세스:**  
1. 운용역 → `/api/registry` PATCH로 Gate2 리뷰 점수 입력  
2. AX팀 → `/api/approve/[id]` POST (action: approve로 pilot → production 전환)  
3. 전환 시 AuditLog 자동 기록  
4. 이메일 알림 발송 (신청자)

> **예외:** 연결된 AgentRegistry가 없는 일반 과제(비에이전트 자동화)는 30일 운용 기간만 충족하면 AX팀 단독 승인으로 production 전환 가능.
