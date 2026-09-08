# AX Hub 공통 에이전트 5종 정의

> 작성: Claude AI / 2026-09-07
> 분류: 🏢 AX Request Hub — Phase 0 발의 수준
> 위치: 에이전트 레지스트리(①축) 백단에 `isSystemAgent=true`로 기본값 삽입
> 원칙: 새 메뉴 없음. 기존 `/registry` 화면에서 시스템 에이전트 탭으로 구분 표시

---

## 설계 원칙

### 왜 5종인가
소프트웨어 개발 생명주기(SDLC)의 핵심 단계와 1:1 대응:

```
요구사항분석 → 설계 → 코딩 → 코드점검 → 시험
```

- **결함수정 제거**: 코딩+코드점검의 반복 루프이지 별도 단계가 아님. 에이전트를 따로 두면 책임 경계만 불명확해짐
- **통합시험 흡수**: 시험생성과 통합시험 모두 "테스트 케이스·시나리오를 산출물로 내는 것"으로 목적이 동일. 실제 시험 실행은 인프라 연동이 필요한 다른 문제

### 공통 에이전트의 위치

```
에이전트 레지스트리
  ├── 시스템 에이전트 (5종, isSystemAgent=true)
  │     ├── 요구사항분석  common-requirements
  │     ├── 설계          common-design
  │     ├── 코딩          common-coding
  │     ├── 코드점검      common-code-review
  │     └── 시험          common-test
  │
  └── 도메인 에이전트 (임직원 신청·심사·등재)
        ├── ETF분석봇
        ├── 보고서생성봇
        └── ...
```

도메인 에이전트 신청 시 "사용할 공통 에이전트 선택" 체크박스로 조합 — `/projects/new` A-1 작업과 함께 반영.

---

## 공통 에이전트 5종 상세 정의

### 1. 요구사항분석 에이전트

| 항목 | 내용 |
|---|---|
| **agentKey** | `common-requirements` |
| **agentName** | 요구사항분석 에이전트 |
| **commonAgentType** | `REQUIREMENTS` |
| **taskType** | `REQ_ANALYSIS` |
| **purpose** | 사용자 요청(자유 텍스트)을 구조화된 기능 명세로 변환 |
| **권장 벤더** | claude (긴 컨텍스트, 한국어 품질) |

**입력**
```ts
{
  request: string           // 사용자 요청 (자유 텍스트)
  context?: string          // 비즈니스 컨텍스트, 기존 시스템 정보
  constraints?: string[]    // 기술·규정 제약사항
}
```

**출력**
```ts
{
  fr: { id: string; description: string; priority: 'HIGH'|'MED'|'LOW' }[]  // 기능 요구사항
  nfr: { category: string; description: string }[]                          // 비기능 요구사항
  inScope: string[]         // 이번 범위에 포함
  outScope: string[]        // 다음으로 미루는 것
  glossary: { term: string; definition: string }[]  // 도메인 용어 정의
  ambiguities: string[]     // 추가 확인이 필요한 항목
}
```

**삼성AM 특화**
- 자산운용 규정 용어(ETF, NAV, 설정·해지 등) 사전 컨텍스트 내장
- 금융 데이터 기밀등급(PUBLIC/RESTRICTED/CONFIDENTIAL) 요건 자동 식별
- AX Hub 신청 폼(`/projects/new`) 항목과 출력 구조 정합

---

### 2. 설계 에이전트

| 항목 | 내용 |
|---|---|
| **agentKey** | `common-design` |
| **agentName** | 설계 에이전트 |
| **commonAgentType** | `DESIGN` |
| **taskType** | `ARCH_DESIGN` |
| **purpose** | 요구사항을 아키텍처·DB·API 설계 산출물로 구체화. 문서화 포함 |
| **권장 벤더** | claude |

**입력**
```ts
{
  requirements: FR[]        // 요구사항분석 에이전트 출력
  techStack: {
    language: string        // 예: 'TypeScript', 'Python'
    framework: string       // 예: 'Next.js', 'FastAPI'
    db: string              // 예: 'SQLite', 'PostgreSQL'
  }
  existingSystems?: string[]  // 연동 대상 시스템
}
```

**출력**
```ts
{
  architecture: string      // Mermaid flowchart (필수)
  sequence: string          // Mermaid sequenceDiagram (필수)
  schema: {
    tables: { name: string; columns: Column[]; relations: string[] }[]
  }
  apis: {
    method: 'GET'|'POST'|'PATCH'|'DELETE'
    path: string
    description: string
    auth: string
    request?: object
    response: object
  }[]
  designDecisions: { decision: string; rationale: string; alternatives: string[] }[]
  openIssues: string[]      // 미결 사항
}
```

**삼성AM 특화**
- AX Hub 개발 표준 자동 적용: API 응답 형식 `{ data, message, error }`, Mermaid 2개 이상 필수
- 보안 원칙 자동 반영: SQL 파라미터 바인딩, XSS 방지
- AX Hub 기술스택(Next.js/Prisma/SQLite→PostgreSQL) 기본값 프리셋

---

### 3. 코딩 에이전트

| 항목 | 내용 |
|---|---|
| **agentKey** | `common-coding` |
| **agentName** | 코딩 에이전트 |
| **commonAgentType** | `CODING` |
| **taskType** | `CODE_GEN` |
| **purpose** | 설계 산출물을 실제 동작하는 코드로 구현 |
| **권장 벤더** | claude(Next.js/TypeScript) / gpt(Python/FastAPI) — Qwen이 스택 기반 자동 라우팅 |

**입력**
```ts
{
  spec: {
    api: APISpec            // 설계 에이전트 출력의 API 명세
    schema: DBSchema        // 설계 에이전트 출력의 DB 스키마
  }
  techStack: TechStack
  conventions: string[]     // 코딩 컨벤션 (예: 'no-any', 'prisma-param-binding')
  existingCode?: string     // 수정 대상 기존 코드 (있을 경우)
}
```

**출력**
```ts
{
  files: {
    path: string            // 파일 경로
    content: string         // 코드 내용
    isNewFile: boolean
  }[]
  testStubs: {
    path: string
    content: string         // 테스트 스텁 (빈 케이스)
  }[]
  migrationScript?: string  // DB 스키마 변경이 있을 경우
  changeLog: string         // 변경 내역 요약
}
```

**삼성AM 특화**
- AX Hub 보안 원칙 하드코딩 금지 체크: `f-string SQL`, `dangerouslySetInnerHTML` 감지 시 거부
- `requireRole()` 권한 체크 누락 자동 지적
- Prisma Client 패턴 자동 적용 (raw query 지양)

---

### 4. 코드점검 에이전트

| 항목 | 내용 |
|---|---|
| **agentKey** | `common-code-review` |
| **agentName** | 코드점검 에이전트 |
| **commonAgentType** | `CODE_REVIEW` |
| **taskType** | `CODE_REVIEW` |
| **purpose** | 보안·성능·컨벤션·거버넌스 기준으로 코드를 검토. 결함 발견 시 수정 방향 제시(코딩 에이전트와의 루프 역할 포함) |
| **권장 벤더** | claude |

**입력**
```ts
{
  code: string              // diff 또는 전체 파일
  context: {
    purpose: string         // 해당 코드의 목적
    techStack: TechStack
  }
  checklist?: string[]      // 추가 점검 항목 (없으면 기본 체크리스트 적용)
}
```

**출력**
```ts
{
  issues: {
    severity: 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'
    file: string
    line?: number
    description: string
    suggestion: string      // 구체적 수정 방향
  }[]
  verdict: 'PASS'|'FAIL'   // CRITICAL 또는 HIGH가 하나라도 있으면 FAIL
  summary: string
  techStandardCheck: {      // AX Hub 개발 표준 6항목 자동 체크
    hasApiSpec: boolean
    hasDataClassification: boolean
    hasAuditLog: boolean
    hasTestCoverage: boolean
    hasDataIntegrity: boolean
    hasHumanInLoop: boolean
    passed: boolean
    failedItems: string[]
  }
}
```

**삼성AM 특화**
- **AX Hub 개발 표준 6항목 자동 체크** (오늘 만든 필터링 게이트의 `checkTechStandards()`와 동일 기준)
- `isHighImpact=true`인 에이전트 코드일 경우 투명성 요건(AI-GUI-002 제12조) 자동 지적
- Policy Gateway 통합 여부 체크 (에이전트가 AX Hub를 통해 실행되는지)
- 결함 발견 시 코딩 에이전트에게 재작업 지시할 수 있는 피드백 포맷으로 출력

---

### 5. 시험 에이전트

| 항목 | 내용 |
|---|---|
| **agentKey** | `common-test` |
| **agentName** | 시험 에이전트 |
| **commonAgentType** | `TEST` |
| **taskType** | `TEST_GEN` |
| **purpose** | 단위·통합 테스트 케이스 및 시나리오 생성. 커버리지 목표 기준 검증 |
| **권장 벤더** | claude |

**입력**
```ts
{
  apis: APISpec[]           // 설계 에이전트 출력
  requirements: FR[]        // 요구사항분석 에이전트 출력
  code?: string             // 코딩 에이전트 출력 (있으면 정확도 향상)
  coverageTarget?: number   // 목표 커버리지 (기본값: 80%)
}
```

**출력**
```ts
{
  unitTests: {
    path: string
    content: string         // 실제 테스트 코드
    targetFunction: string
    cases: { description: string; input: unknown; expected: unknown }[]
  }[]
  integrationScenarios: {
    title: string
    steps: string[]
    expectedResult: string
    components: string[]    // 관여하는 컴포넌트 목록
  }[]
  coverageEstimate: number  // 예상 커버리지(%)
  missingCoverage: string[] // 커버리지 부족 영역
  verdict: 'MEETS_TARGET'|'BELOW_TARGET'
}
```

**삼성AM 특화**
- 개발 표준 기준(80% 이상) 충족 여부 자동 판정
- AX Hub Policy Gateway 엔드포인트 테스트 케이스 자동 포함 (ALLOW/WARN/BLOCK 각 시나리오)
- 금융 데이터 관련 엣지케이스 자동 제안 (NULL NAV, 거래 한도 초과 등)

---

## 스키마 변경 (최소)

```prisma
// AgentRegistry에 필드 2개 추가
isSystemAgent    Boolean  @default(false)
// true = 공통 에이전트. 일반 임직원 신청 불가, AX_TEAM만 수정 가능, 삭제 불가

commonAgentType  String?
// 'REQUIREMENTS' | 'DESIGN' | 'CODING' | 'CODE_REVIEW' | 'TEST'
// isSystemAgent=true일 때만 사용
```

```ts
// src/lib/ai-gateway/routing.ts — TaskType에 추가
export type TaskType =
  | 'TIER1_PARSE'
  | 'CONSULTATION_CONTINUE'
  | 'GATE2_REVIEW'
  | 'GATE3_RATIONALE'
  | 'KPI_EVAL'
  | 'SYNTHESIZE'
  | 'GENERAL'
  | 'REQ_ANALYSIS'       // 신규
  | 'ARCH_DESIGN'        // 신규
  | 'CODE_GEN'           // 신규
  | 'CODE_REVIEW'        // 신규
  | 'TEST_GEN'           // 신규
```

---

## Seed 데이터 (초기 삽입)

```ts
// prisma/seed-system-agents.ts
const SYSTEM_AGENTS = [
  {
    agentKey: 'common-requirements',
    agentName: '요구사항분석 에이전트',
    commonAgentType: 'REQUIREMENTS',
    purpose: '사용자 요청을 구조화된 기능 명세(FR/NFR/범위)로 변환',
    recommendedProvider: 'claude',
    owner: 'AX_TEAM',
    isSystemAgent: true,
    lifecycleStage: 'ACTIVE',
    gate1Passed: true, gate2Passed: true, gate3Passed: true,
    riskType: 1,
    scope: 'COMPANY',
  },
  {
    agentKey: 'common-design',
    agentName: '설계 에이전트',
    commonAgentType: 'DESIGN',
    purpose: '요구사항을 아키텍처·DB스키마·API명세·Mermaid 다이어그램으로 구체화',
    recommendedProvider: 'claude',
    owner: 'AX_TEAM',
    isSystemAgent: true,
    lifecycleStage: 'ACTIVE',
    gate1Passed: true, gate2Passed: true, gate3Passed: true,
    riskType: 1,
    scope: 'COMPANY',
  },
  {
    agentKey: 'common-coding',
    agentName: '코딩 에이전트',
    commonAgentType: 'CODING',
    purpose: '설계 산출물을 실제 코드로 구현. 스택에 따라 벤더 자동 라우팅',
    recommendedProvider: null, // Qwen이 스택 기반 자동 라우팅
    owner: 'AX_TEAM',
    isSystemAgent: true,
    lifecycleStage: 'ACTIVE',
    gate1Passed: true, gate2Passed: true, gate3Passed: true,
    riskType: 2,
    scope: 'COMPANY',
  },
  {
    agentKey: 'common-code-review',
    agentName: '코드점검 에이전트',
    commonAgentType: 'CODE_REVIEW',
    purpose: '보안·성능·AX Hub 개발표준 6항목 기준 코드 검토. PASS/FAIL 판정',
    recommendedProvider: 'claude',
    owner: 'AX_TEAM',
    isSystemAgent: true,
    lifecycleStage: 'ACTIVE',
    gate1Passed: true, gate2Passed: true, gate3Passed: true,
    riskType: 1,
    scope: 'COMPANY',
  },
  {
    agentKey: 'common-test',
    agentName: '시험 에이전트',
    commonAgentType: 'TEST',
    purpose: '단위·통합 테스트 케이스 생성. 커버리지 80% 달성 여부 판정',
    recommendedProvider: 'claude',
    owner: 'AX_TEAM',
    isSystemAgent: true,
    lifecycleStage: 'ACTIVE',
    gate1Passed: true, gate2Passed: true, gate3Passed: true,
    riskType: 1,
    scope: 'COMPANY',
  },
]
```

---

## 구현 작업 분리

| 트랙 | 내용 | 공수 |
|---|---|---|
| S-1 | 스키마 추가(`isSystemAgent`, `commonAgentType`) + TaskType 5종 추가 | 반나절 |
| S-2 | seed 파일 작성 + `prisma db seed` | 반나절 |
| S-3 | `/registry` 화면에 시스템/도메인 탭 구분 + 시스템 에이전트 수정·삭제 비활성화 | 1일 |
| S-4 | `/projects/new` A-1 작업에 "공통 에이전트 선택" 체크박스 추가 | 반나절 (A-1과 병행) |

**S-1·S-2는 지금 당장 가능** (스키마 단순 추가, 기존 로직 무변경).
**S-3·S-4는 dev-standard 트랙 A 작업과 타이밍 맞춰 진행**.

---

## 미결 사항

| 우선순위 | 항목 |
|---|---|
| ★★ | 도메인 에이전트가 공통 에이전트를 "조합"하는 방식 — 단순 체크박스 선택인지, 실행 파이프라인 연동인지 (Phase 1은 체크박스 선택 이력만, Phase 2에서 실행 연동) |
| ★★ | 코드점검 에이전트 출력(`techStandardCheck`)을 개발표준 필터링 게이트(`checkTechStandards()`)와 실제로 연동할지 — 연동하면 공통 에이전트가 게이트를 자동 통과시키는 구조가 됨 |
| ★ | 공통 에이전트 버전 관리 (v1.0 → v1.1 개정 시 기존 도메인 에이전트와의 호환성) |
| ★ | 발의서·기능기획서 작성 (이 문서 기반, 인표님 승인 후 Jarvis 디스패치) |
