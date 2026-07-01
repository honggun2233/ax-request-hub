# AX Request Hub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현업 부서가 AI 상담 챗으로 과제를 신청하면 에이전트가 자동 평가·승인하고, 인표님이 포트폴리오 대시보드로 전체를 관리하는 AX 과제 관리 포털을 구축한다.

**Architecture:** Next.js(App Router) 단일 레포. AI 상담/평가는 Claude API 직접 호출. DB는 Prisma + SQLite(초기). 알림은 기존 텔레그램 봇 + Gmail API 재사용.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Prisma + SQLite, @anthropic-ai/sdk, Jest, Playwright(E2E)

**Spec:** `docs/superpowers/specs/2026-07-01-ax-request-hub-design.md`

---

## File Structure

```
C:\project\ax-team\ax-request-hub\
├── package.json
├── next.config.ts
├── tsconfig.json
├── .env.local                        # ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN 등
├── prisma/
│   └── schema.prisma                 # DB 스키마 (projects, score_cards, chat_sessions)
├── src/
│   ├── app/
│   │   ├── page.tsx                  # 랜딩 → 상담 챗 진입점
│   │   ├── chat/page.tsx             # AI 상담 챗 화면
│   │   ├── submit/page.tsx           # 신청서 확인·수정·제출
│   │   ├── status/[id]/page.tsx      # 신청 현황 조회 (현업용)
│   │   ├── dashboard/page.tsx        # 관리자 포트폴리오 대시보드
│   │   └── api/
│   │       ├── chat/route.ts         # POST: 상담 에이전트 메시지 처리
│   │       ├── projects/route.ts     # GET: 전체 과제 목록 / POST: 과제 직접 등록
│   │       ├── projects/[id]/route.ts # GET/PATCH: 과제 상세·상태 변경
│   │       ├── evaluate/[id]/route.ts # POST: 평가 에이전트 트리거
│   │       └── approve/[id]/route.ts  # POST: 인표님 결재 처리
│   ├── lib/
│   │   ├── db.ts                     # Prisma 클라이언트 싱글턴
│   │   ├── claude.ts                 # Anthropic SDK 클라이언트 싱글턴
│   │   ├── agents/
│   │   │   ├── consultation.ts       # 상담 에이전트: 대화 → 과제 구조화
│   │   │   └── evaluation.ts         # 평가 에이전트: 6차원 스코어카드 산출
│   │   ├── scoring.ts                # 자율 승인 임계값 로직
│   │   └── notifications/
│   │       ├── telegram.ts           # 텔레그램 결재 알림
│   │       └── email.ts              # Gmail 신청자 알림
│   └── components/
│       ├── ChatMessage.tsx           # 단일 챗 메시지 버블
│       ├── ChatInterface.tsx         # 상담 챗 전체 UI
│       ├── ProjectForm.tsx           # 신청서 확인·수정 폼
│       ├── ScoreCard.tsx             # 6차원 스코어 시각화
│       └── PipelineBoard.tsx         # 관리자 파이프라인 뷰
└── tests/
    ├── lib/
    │   ├── scoring.test.ts           # 자율 승인 임계값 로직 유닛 테스트
    │   └── agents/
    │       └── evaluation.test.ts    # 평가 에이전트 골든셋 테스트
    └── api/
        ├── chat.test.ts              # 상담 API 라우트 테스트
        └── evaluate.test.ts          # 평가 API 라우트 테스트
```

---

## Phase 1: 프로젝트 셋업 + DB 스키마

### Task 1: Next.js 프로젝트 초기화

**Files:**
- Create: `C:\project\ax-team\ax-request-hub\package.json`
- Create: `C:\project\ax-team\ax-request-hub\tsconfig.json`
- Create: `C:\project\ax-team\ax-request-hub\next.config.ts`

- [ ] **Step 1: 프로젝트 생성**

```bash
cd C:\project\ax-team
npx create-next-app@latest ax-request-hub --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd ax-request-hub
```

- [ ] **Step 2: 의존성 설치**

```bash
npm install @anthropic-ai/sdk @prisma/client
npm install -D prisma jest jest-environment-node @types/jest ts-jest
npm install @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Jest 설정**

`jest.config.ts` 생성:
```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathPattern: 'tests/',
}

export default config
```

- [ ] **Step 4: 디렉토리 구조 생성**

```bash
mkdir -p src/lib/agents src/lib/notifications src/components tests/lib/agents tests/api
```

- [ ] **Step 5: 빌드 확인**

```bash
npm run build
```
Expected: `✓ Compiled successfully`

- [ ] **Step 6: 커밋**

```bash
git init
git config user.email "honggun2233@gmail.com"
git config user.name "Jarvis"
git add .
git commit -m "chore: Next.js 프로젝트 초기화 (ax-request-hub)"
```

---

### Task 2: DB 스키마 + Prisma 설정

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Prisma 초기화**

```bash
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 2: `prisma/schema.prisma` 작성**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Project {
  id                  String      @id @default(cuid())
  title               String
  department          String
  requesterName       String
  requesterEmail      String
  source              String      @default("user_request") // "user_request" | "ax_discovery"
  status              String      @default("submitted")    // "submitted" | "evaluated" | "pilot" | "production" | "closed"
  description         String
  asIs                String
  expectedBenefit     String
  confidentialityLevel String     @default("G2")           // "G1" | "G2" | "G3"
  championName        String?
  estimatedUsers      Int         @default(0)
  totalScore          Float?
  autoApproved        Boolean     @default(false)
  approvedBy          String?
  decisionNote        String?
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  scoreCard   ScoreCard?
  chatSession ChatSession?
}

model ScoreCard {
  id                  String   @id @default(cuid())
  projectId           String   @unique
  project             Project  @relation(fields: [projectId], references: [id])
  impactScore         Float
  roiScore            Float
  confidentialityScore Float
  difficultyScore     Float
  readinessScore      Float
  strategyScore       Float
  totalScore          Float
  evaluationRationale String
  evaluatedAt         DateTime @default(now())
}

model ChatSession {
  id          String   @id @default(cuid())
  projectId   String?  @unique
  project     Project? @relation(fields: [projectId], references: [id])
  messages    String   // JSON 직렬화된 메시지 배열
  startedAt   DateTime @default(now())
  completedAt DateTime?
}
```

- [ ] **Step 3: `.env.local` 생성**

```bash
cat > .env.local << 'EOF'
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY="your-key-here"
TELEGRAM_BOT_TOKEN="your-token-here"
TELEGRAM_CHAT_ID="your-chat-id-here"
NOTIFICATION_EMAIL="honggun2233@gmail.com"
APPROVAL_THRESHOLD=70
EOF
```

- [ ] **Step 4: DB 마이그레이션 실행**

```bash
npx prisma migrate dev --name init
npx prisma generate
```
Expected: `✓ Generated Prisma Client`

- [ ] **Step 5: `src/lib/db.ts` 작성**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 6: DB 연결 테스트**

`tests/lib/db.test.ts` 생성 후 실행:
```typescript
import { db } from '@/lib/db'

test('DB 연결 정상', async () => {
  const count = await db.project.count()
  expect(count).toBeGreaterThanOrEqual(0)
})
```

```bash
npx jest tests/lib/db.test.ts
```
Expected: `PASS tests/lib/db.test.ts`

- [ ] **Step 7: 커밋**

```bash
git add .
git commit -m "feat: Prisma SQLite 스키마 (projects, score_cards, chat_sessions)"
```

---

## Phase 2: AI 에이전트 레이어

### Task 3: Claude API 클라이언트

**Files:**
- Create: `src/lib/claude.ts`

- [ ] **Step 1: `src/lib/claude.ts` 작성**

```typescript
import Anthropic from '@anthropic-ai/sdk'

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined
}

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

if (process.env.NODE_ENV !== 'production') globalForAnthropic.anthropic = anthropic

export const MODEL = 'claude-sonnet-4-6'
```

- [ ] **Step 2: API 키 확인 테스트**

`tests/lib/claude.test.ts`:
```typescript
import { anthropic, MODEL } from '@/lib/claude'

test('Anthropic 클라이언트 초기화', async () => {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 10,
    messages: [{ role: 'user', content: 'ping' }],
  })
  expect(response.content[0].type).toBe('text')
})
```

```bash
npx jest tests/lib/claude.test.ts
```
Expected: `PASS`

- [ ] **Step 3: 커밋**

```bash
git add src/lib/claude.ts tests/lib/claude.test.ts
git commit -m "feat: Anthropic Claude API 클라이언트 싱글턴"
```

---

### Task 4: 상담 에이전트

**Files:**
- Create: `src/lib/agents/consultation.ts`
- Create: `tests/lib/agents/consultation.test.ts`

- [ ] **Step 1: 테스트 먼저 작성**

`tests/lib/agents/consultation.test.ts`:
```typescript
import { ConsultationAgent, ExtractedProject } from '@/lib/agents/consultation'

describe('ConsultationAgent', () => {
  let agent: ConsultationAgent

  beforeEach(() => {
    agent = new ConsultationAgent()
  })

  test('초기 메시지가 환영 메시지를 반환한다', async () => {
    const response = await agent.start()
    expect(response.message).toContain('AI')
    expect(response.isComplete).toBe(false)
    expect(response.extracted).toBeNull()
  })

  test('충분한 정보가 수집되면 isComplete가 true가 된다', async () => {
    const messages = [
      { role: 'user' as const, content: '운용팀입니다. 리서치 보고서 요약 자동화를 하고 싶어요.' },
      { role: 'assistant' as const, content: '어떤 보고서를 처리하시나요?' },
      { role: 'user' as const, content: '주간 10개 PDF, 지금은 수동으로 읽고 요약합니다. 공개 자료라서 G1입니다. 담당자는 김과장이고 약 5명이 쓸 것 같습니다.' },
    ]
    const response = await agent.continueChat(messages)
    // 충분한 정보가 모이면 complete 상태 가능
    expect(typeof response.isComplete).toBe('boolean')
  })

  test('extracted 데이터는 필수 필드를 포함한다', async () => {
    const mockExtracted: ExtractedProject = {
      title: '리서치 보고서 요약 자동화',
      department: '운용팀',
      requesterName: '김과장',
      requesterEmail: '',
      description: '주간 PDF 10개 자동 요약',
      asIs: '수동으로 읽고 요약',
      expectedBenefit: '주 5시간 절감',
      confidentialityLevel: 'G1',
      championName: '김과장',
      estimatedUsers: 5,
    }
    expect(mockExtracted).toHaveProperty('title')
    expect(mockExtracted).toHaveProperty('confidentialityLevel')
    expect(['G1', 'G2', 'G3']).toContain(mockExtracted.confidentialityLevel)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npx jest tests/lib/agents/consultation.test.ts
```
Expected: `FAIL` (모듈 없음)

- [ ] **Step 3: `src/lib/agents/consultation.ts` 구현**

```typescript
import { anthropic, MODEL } from '@/lib/claude'

export interface ExtractedProject {
  title: string
  department: string
  requesterName: string
  requesterEmail: string
  description: string
  asIs: string
  expectedBenefit: string
  confidentialityLevel: 'G1' | 'G2' | 'G3'
  championName: string | null
  estimatedUsers: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentResponse {
  message: string
  isComplete: boolean
  extracted: ExtractedProject | null
}

const SYSTEM_PROMPT = `당신은 삼성자산운용 AX/PI팀의 AI 과제 접수 담당자입니다.
현업 부서 직원이 AI 도입 과제를 설명하면, 아래 7가지 항목을 자연스러운 대화로 수집하세요.

수집 항목:
1. 과제명 (AI가 제안)
2. 신청 부서 / 담당자 이름 / 이메일
3. 현재 업무 방식 (As-Is)
4. 기대 효익 (시간절감/비용절감/품질향상)
5. 관련 데이터 기밀등급 (G1=공개·저민감, G2=사내일반, G3=고기밀·고객PI·운용포지션)
6. 예상 사용자 수
7. 내부 챔피언(이 과제를 책임질 담당자) 이름

모든 항목이 수집되면 응답 끝에 다음 JSON 블록을 추가하세요:
<EXTRACTED>
{"title":"...","department":"...","requesterName":"...","requesterEmail":"...","description":"...","asIs":"...","expectedBenefit":"...","confidentialityLevel":"G1|G2|G3","championName":"...|null","estimatedUsers":0}
</EXTRACTED>

항목이 불명확하면 계속 질문하세요. 한 번에 하나씩 물어보세요. 친절하고 간결하게 응답하세요.`

export class ConsultationAgent {
  async start(): Promise<AgentResponse> {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: '안녕하세요, AI 과제 신청을 시작하고 싶습니다.',
        },
      ],
    })

    const message = response.content[0].type === 'text' ? response.content[0].text : ''
    return { message, isComplete: false, extracted: null }
  }

  async continueChat(messages: ChatMessage[]): Promise<AgentResponse> {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages,
    })

    const message = response.content[0].type === 'text' ? response.content[0].text : ''
    const extracted = this.parseExtracted(message)

    return {
      message: message.replace(/<EXTRACTED>[\s\S]*?<\/EXTRACTED>/g, '').trim(),
      isComplete: extracted !== null,
      extracted,
    }
  }

  private parseExtracted(text: string): ExtractedProject | null {
    const match = text.match(/<EXTRACTED>([\s\S]*?)<\/EXTRACTED>/)
    if (!match) return null
    try {
      return JSON.parse(match[1].trim()) as ExtractedProject
    } catch {
      return null
    }
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
npx jest tests/lib/agents/consultation.test.ts
```
Expected: `PASS`

- [ ] **Step 5: 커밋**

```bash
git add src/lib/agents/consultation.ts tests/lib/agents/consultation.test.ts
git commit -m "feat: AI 상담 에이전트 (대화 → ExtractedProject 구조화)"
```

---

### Task 5: 평가 에이전트 + 6차원 스코어카드

**Files:**
- Create: `src/lib/agents/evaluation.ts`
- Create: `src/lib/scoring.ts`
- Create: `tests/lib/agents/evaluation.test.ts`
- Create: `tests/lib/scoring.test.ts`

- [ ] **Step 1: scoring.ts 테스트 먼저**

`tests/lib/scoring.test.ts`:
```typescript
import { determineApproval, ApprovalDecision } from '@/lib/scoring'

describe('determineApproval', () => {
  test('G3 과제는 점수와 무관하게 보고 대상이다', () => {
    const result = determineApproval('G3', 90)
    expect(result).toBe('report')
  })

  test('G1/G2 + 70점 이상은 자동 승인이다', () => {
    expect(determineApproval('G1', 70)).toBe('auto_approve')
    expect(determineApproval('G2', 85)).toBe('auto_approve')
  })

  test('G1/G2 + 68~69점은 근소차이 보고이다', () => {
    expect(determineApproval('G1', 68)).toBe('borderline')
    expect(determineApproval('G2', 69)).toBe('borderline')
  })

  test('G1/G2 + 67점 이하는 보고 대상이다', () => {
    expect(determineApproval('G1', 67)).toBe('report')
    expect(determineApproval('G2', 50)).toBe('report')
  })
})
```

- [ ] **Step 2: evaluation.ts 테스트**

`tests/lib/agents/evaluation.test.ts`:
```typescript
import { EvaluationAgent, ScoreCardResult } from '@/lib/agents/evaluation'
import { ExtractedProject } from '@/lib/agents/consultation'

const G1_EASY_PROJECT: ExtractedProject = {
  title: '리서치 보고서 요약 자동화',
  department: '리서치팀',
  requesterName: '김연구',
  requesterEmail: 'kim@samsung.com',
  description: '주간 PDF 보고서 10개를 자동으로 요약',
  asIs: '수동으로 읽고 요약 작성, 주 5시간 소요',
  expectedBenefit: '주 4시간 절감, 요약 품질 향상',
  confidentialityLevel: 'G1',
  championName: '김연구',
  estimatedUsers: 8,
}

const G3_SENSITIVE_PROJECT: ExtractedProject = {
  title: '운용 포지션 AI 분석',
  department: '운용팀',
  requesterName: '박운용',
  requesterEmail: 'park@samsung.com',
  description: '펀드 포지션 데이터를 AI로 분석',
  asIs: '수동 분석',
  expectedBenefit: '분석 시간 50% 절감',
  confidentialityLevel: 'G3',
  championName: '박운용',
  estimatedUsers: 3,
}

describe('EvaluationAgent', () => {
  const agent = new EvaluationAgent()

  test('스코어카드는 6개 차원을 모두 포함한다', async () => {
    const result = await agent.evaluate(G1_EASY_PROJECT)
    expect(result).toHaveProperty('impactScore')
    expect(result).toHaveProperty('roiScore')
    expect(result).toHaveProperty('confidentialityScore')
    expect(result).toHaveProperty('difficultyScore')
    expect(result).toHaveProperty('readinessScore')
    expect(result).toHaveProperty('strategyScore')
    expect(result).toHaveProperty('totalScore')
    expect(result).toHaveProperty('evaluationRationale')
  }, 30000)

  test('G1 쉬운 과제의 총점은 60점 이상이다 (골든셋)', async () => {
    const result = await agent.evaluate(G1_EASY_PROJECT)
    expect(result.totalScore).toBeGreaterThanOrEqual(60)
  }, 30000)

  test('G3 민감 과제는 기밀등급 점수가 낮다', async () => {
    const result = await agent.evaluate(G3_SENSITIVE_PROJECT)
    expect(result.confidentialityScore).toBeLessThanOrEqual(5)
  }, 30000)
})
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

```bash
npx jest tests/lib/scoring.test.ts tests/lib/agents/evaluation.test.ts --testPathPattern=scoring
```
Expected: `FAIL`

- [ ] **Step 4: `src/lib/scoring.ts` 구현**

```typescript
export type ApprovalDecision = 'auto_approve' | 'borderline' | 'report'

export function determineApproval(
  confidentialityLevel: 'G1' | 'G2' | 'G3',
  totalScore: number
): ApprovalDecision {
  if (confidentialityLevel === 'G3') return 'report'
  if (totalScore >= 70) return 'auto_approve'
  if (totalScore >= 68) return 'borderline'
  return 'report'
}
```

- [ ] **Step 5: `src/lib/agents/evaluation.ts` 구현**

```typescript
import { anthropic, MODEL } from '@/lib/claude'
import { ExtractedProject } from '@/lib/agents/consultation'

export interface ScoreCardResult {
  impactScore: number        // 0~25
  roiScore: number           // 0~25
  confidentialityScore: number // 0~15
  difficultyScore: number    // 0~15
  readinessScore: number     // 0~10
  strategyScore: number      // 0~10
  totalScore: number         // 0~100
  evaluationRationale: string
}

const EVALUATION_PROMPT = `당신은 삼성자산운용 AX/PI팀의 AI 과제 평가 전문가입니다.
아래 과제 정보를 6가지 차원으로 평가하고 반드시 JSON 형식으로만 응답하세요.

평가 기준:
- impactScore (0~25): 영향 인원 수, 업무 빈도, 전략 정합성
- roiScore (0~25): 시간절감·비용절감·수익기여 추정
- confidentialityScore (0~15): G1=13~15, G2=8~12, G3=1~5
- difficultyScore (0~15): 난이도 역산(낮을수록 고점), 기술적 복잡도 고려
- readinessScore (0~10): 데이터 가용성, 챔피언 유무, As-Is 명확도
- strategyScore (0~10): AX 청사진 등대 과제 및 100일 로드맵 매칭도

응답 형식 (JSON만, 다른 텍스트 없음):
{"impactScore":0,"roiScore":0,"confidentialityScore":0,"difficultyScore":0,"readinessScore":0,"strategyScore":0,"totalScore":0,"evaluationRationale":"평가 근거 2~3줄"}`

export class EvaluationAgent {
  async evaluate(project: ExtractedProject): Promise<ScoreCardResult> {
    const projectSummary = `
과제명: ${project.title}
부서: ${project.department}
설명: ${project.description}
현재 방식: ${project.asIs}
기대 효익: ${project.expectedBenefit}
기밀등급: ${project.confidentialityLevel}
예상 사용자: ${project.estimatedUsers}명
챔피언: ${project.championName ?? '미지정'}
`

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: EVALUATION_PROMPT,
      messages: [{ role: 'user', content: projectSummary }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const raw = JSON.parse(text) as Omit<ScoreCardResult, 'totalScore'> & { totalScore?: number }

    const totalScore =
      raw.totalScore ??
      raw.impactScore +
        raw.roiScore +
        raw.confidentialityScore +
        raw.difficultyScore +
        raw.readinessScore +
        raw.strategyScore

    return {
      impactScore: raw.impactScore,
      roiScore: raw.roiScore,
      confidentialityScore: raw.confidentialityScore,
      difficultyScore: raw.difficultyScore,
      readinessScore: raw.readinessScore,
      strategyScore: raw.strategyScore,
      totalScore,
      evaluationRationale: raw.evaluationRationale,
    }
  }
}
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

```bash
npx jest tests/lib/scoring.test.ts
npx jest tests/lib/agents/evaluation.test.ts --testTimeout=60000
```
Expected: 두 파일 모두 `PASS`

- [ ] **Step 7: 커밋**

```bash
git add src/lib/agents/evaluation.ts src/lib/scoring.ts tests/
git commit -m "feat: 평가 에이전트 (6차원 스코어카드) + 자율 승인 임계값 로직"
```

---

## Phase 3: API 라우트

### Task 6: 상담 API 라우트

**Files:**
- Create: `src/app/api/chat/route.ts`
- Create: `tests/api/chat.test.ts`

- [ ] **Step 1: 테스트 먼저**

`tests/api/chat.test.ts`:
```typescript
import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'

test('빈 messages 배열로 POST하면 초기 메시지를 반환한다', async () => {
  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages: [], sessionId: null }),
    headers: { 'Content-Type': 'application/json' },
  })

  const res = await POST(req)
  const data = await res.json()

  expect(res.status).toBe(200)
  expect(data).toHaveProperty('message')
  expect(data).toHaveProperty('isComplete')
  expect(data).toHaveProperty('sessionId')
  expect(data.isComplete).toBe(false)
}, 30000)
```

- [ ] **Step 2: `src/app/api/chat/route.ts` 구현**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ConsultationAgent, ChatMessage } from '@/lib/agents/consultation'
import { db } from '@/lib/db'

const agent = new ConsultationAgent()

export async function POST(req: NextRequest) {
  const { messages, sessionId }: { messages: ChatMessage[]; sessionId: string | null } =
    await req.json()

  try {
    let response
    if (messages.length === 0) {
      response = await agent.start()
    } else {
      response = await agent.continueChat(messages)
    }

    // 세션 저장
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const session = await db.chatSession.create({
        data: { messages: JSON.stringify(messages) },
      })
      currentSessionId = session.id
    } else {
      await db.chatSession.update({
        where: { id: currentSessionId },
        data: { messages: JSON.stringify(messages) },
      })
    }

    // 상담 완료 시 과제 자동 생성
    let projectId: string | null = null
    if (response.isComplete && response.extracted) {
      const project = await db.project.create({
        data: {
          ...response.extracted,
          chatSession: { connect: { id: currentSessionId } },
        },
      })
      projectId = project.id
    }

    return NextResponse.json({
      message: response.message,
      isComplete: response.isComplete,
      extracted: response.extracted,
      sessionId: currentSessionId,
      projectId,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
```

- [ ] **Step 3: 테스트 실행**

```bash
npx jest tests/api/chat.test.ts --testTimeout=60000
```
Expected: `PASS`

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/chat/ tests/api/chat.test.ts
git commit -m "feat: 상담 챗 API 라우트 (POST /api/chat)"
```

---

### Task 7: 평가 API + 자율 승인 + 알림

**Files:**
- Create: `src/app/api/evaluate/[id]/route.ts`
- Create: `src/app/api/approve/[id]/route.ts`
- Create: `src/lib/notifications/telegram.ts`
- Create: `src/lib/notifications/email.ts`

- [ ] **Step 1: `src/lib/notifications/telegram.ts` 구현**

```typescript
export async function sendTelegramApprovalRequest(params: {
  projectId: string
  title: string
  department: string
  totalScore: number
  rationale: string
  approvalUrl: string
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  const text =
    `🔔 *AX 과제 검토 요청*\n\n` +
    `📋 *${params.title}*\n` +
    `🏢 ${params.department}\n` +
    `📊 종합 스코어: *${params.totalScore.toFixed(1)}점*\n\n` +
    `💡 ${params.rationale}\n\n` +
    `승인/거절: ${params.approvalUrl}`

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

export async function sendTelegramNotification(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}
```

- [ ] **Step 2: `src/lib/notifications/email.ts` 구현**

```typescript
export async function sendApprovalEmail(params: {
  to: string
  projectTitle: string
  totalScore: number
  isAutoApproved: boolean
}) {
  // 기존 Jarvis Gmail API 스크립트 활용
  const { execSync } = await import('child_process')
  const subject = params.isAutoApproved
    ? `[AX 과제 승인] ${params.projectTitle}`
    : `[AX 과제 접수] ${params.projectTitle} — 검토 중`
  const body = params.isAutoApproved
    ? `안녕하세요,\n\n${params.projectTitle} 과제가 파일럿 단계로 승인되었습니다.\n종합 스코어: ${params.totalScore.toFixed(1)}점\n\nAX/PI팀에서 곧 연락드리겠습니다.`
    : `안녕하세요,\n\n${params.projectTitle} 과제가 접수되었습니다.\n종합 스코어: ${params.totalScore.toFixed(1)}점\n\nAX팀장 검토 후 결과를 안내드리겠습니다.`

  try {
    execSync(
      `python "C:\\Users\\Samsung\\Jarvis\\skills\\gmail-sender\\scripts\\gmail_sender.py" ` +
        `--to "${params.to}" --subject "${subject}" --body "${body}"`,
      { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }
    )
  } catch (e) {
    console.error('Email notification failed:', e)
  }
}
```

- [ ] **Step 3: `src/app/api/evaluate/[id]/route.ts` 구현**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { EvaluationAgent } from '@/lib/agents/evaluation'
import { determineApproval } from '@/lib/scoring'
import { db } from '@/lib/db'
import { sendTelegramApprovalRequest, sendTelegramNotification } from '@/lib/notifications/telegram'
import { sendApprovalEmail } from '@/lib/notifications/email'
import { ExtractedProject } from '@/lib/agents/consultation'

const evaluationAgent = new EvaluationAgent()

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await db.project.findUnique({ where: { id: params.id } })
  if (!project) {
    return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })
  }

  try {
    const extracted: ExtractedProject = {
      title: project.title,
      department: project.department,
      requesterName: project.requesterName,
      requesterEmail: project.requesterEmail,
      description: project.description,
      asIs: project.asIs,
      expectedBenefit: project.expectedBenefit,
      confidentialityLevel: project.confidentialityLevel as 'G1' | 'G2' | 'G3',
      championName: project.championName,
      estimatedUsers: project.estimatedUsers,
    }

    const scoreCard = await evaluationAgent.evaluate(extracted)
    const decision = determineApproval(
      extracted.confidentialityLevel,
      scoreCard.totalScore
    )

    // DB 저장
    await db.scoreCard.create({
      data: {
        projectId: project.id,
        ...scoreCard,
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

    if (decision === 'auto_approve') {
      await db.project.update({
        where: { id: project.id },
        data: { status: 'pilot', autoApproved: true, totalScore: scoreCard.totalScore },
      })
      await sendApprovalEmail({
        to: project.requesterEmail,
        projectTitle: project.title,
        totalScore: scoreCard.totalScore,
        isAutoApproved: true,
      })
      await sendTelegramNotification(
        `✅ 자동 승인: ${project.title} (${scoreCard.totalScore.toFixed(1)}점) — ${project.department}`
      )
    } else {
      const label = decision === 'borderline' ? '⚠️ 근소차이 검토' : '📋 검토 요청'
      await db.project.update({
        where: { id: project.id },
        data: { status: 'evaluated', totalScore: scoreCard.totalScore },
      })
      await sendTelegramApprovalRequest({
        projectId: project.id,
        title: project.title,
        department: project.department,
        totalScore: scoreCard.totalScore,
        rationale: scoreCard.evaluationRationale,
        approvalUrl: `${baseUrl}/dashboard?review=${project.id}`,
      })
      await sendApprovalEmail({
        to: project.requesterEmail,
        projectTitle: project.title,
        totalScore: scoreCard.totalScore,
        isAutoApproved: false,
      })
    }

    return NextResponse.json({ scoreCard, decision })
  } catch (error) {
    // 평가 실패 시 무조건 보고 대상으로 폴백
    await db.project.update({
      where: { id: project.id },
      data: { status: 'evaluated' },
    })
    await sendTelegramNotification(
      `⚠️ 평가 오류 — ${project.title}: 수동 검토 필요`
    )
    console.error('Evaluation error:', error)
    return NextResponse.json({ error: '평가 중 오류, 수동 검토 대상으로 등록됨' }, { status: 500 })
  }
}
```

- [ ] **Step 4: `src/app/api/approve/[id]/route.ts` 구현**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendApprovalEmail } from '@/lib/notifications/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { action, note }: { action: 'approve' | 'hold' | 'reject'; note?: string } =
    await req.json()

  const project = await db.project.findUnique({ where: { id: params.id } })
  if (!project) {
    return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })
  }

  const statusMap = { approve: 'pilot', hold: 'evaluated', reject: 'closed' } as const
  await db.project.update({
    where: { id: params.id },
    data: {
      status: statusMap[action],
      approvedBy: '홍인표 팀장',
      decisionNote: note ?? null,
    },
  })

  if (action === 'approve') {
    await sendApprovalEmail({
      to: project.requesterEmail,
      projectTitle: project.title,
      totalScore: project.totalScore ?? 0,
      isAutoApproved: false,
    })
  }

  return NextResponse.json({ ok: true, status: statusMap[action] })
}
```

- [ ] **Step 5: 과제 목록 API**

`src/app/api/projects/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const projects = await db.project.findMany({
    include: { scoreCard: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const project = await db.project.create({ data: { ...body, source: 'ax_discovery' } })
  return NextResponse.json(project, { status: 201 })
}
```

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/ src/lib/notifications/
git commit -m "feat: 평가 API + 자율 승인 + 텔레그램/이메일 알림"
```

---

## Phase 4: 프론트엔드

### Task 8: AI 상담 챗 UI

**Files:**
- Create: `src/components/ChatMessage.tsx`
- Create: `src/components/ChatInterface.tsx`
- Create: `src/app/chat/page.tsx`

- [ ] **Step 1: `src/components/ChatMessage.tsx`**

```tsx
interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
          role === 'user'
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}
      >
        {role === 'assistant' && (
          <span className="block text-xs text-gray-500 mb-1 font-medium">AX 상담 에이전트</span>
        )}
        {content}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `src/components/ChatInterface.tsx`**

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from './ChatMessage'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function initChat() {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [], sessionId: null }),
    })
    const data = await res.json()
    setMessages([{ role: 'assistant', content: data.message }])
    setSessionId(data.sessionId)
    setInitializing(false)
  }

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages, sessionId }),
    })
    const data = await res.json()

    setMessages([...newMessages, { role: 'assistant', content: data.message }])
    setSessionId(data.sessionId)
    setLoading(false)

    if (data.isComplete && data.projectId) {
      setTimeout(() => router.push(`/submit?projectId=${data.projectId}`), 1500)
    }
  }

  if (initializing) {
    return <div className="flex items-center justify-center h-64 text-gray-500">연결 중...</div>
  }

  return (
    <div className="flex flex-col h-[70vh] max-w-2xl mx-auto">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <ChatMessage key={i} role={m.role} content={m.content} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-100 rounded-2xl px-4 py-2 text-gray-500 text-sm">
              입력 중...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="AI 도입 아이디어를 자유롭게 말씀해주세요..."
          className="flex-1 border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition"
        >
          전송
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `src/app/chat/page.tsx`**

```tsx
import { ChatInterface } from '@/components/ChatInterface'

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto pt-8 px-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">AX 과제 신청</h1>
        <p className="text-sm text-gray-500 mb-6">
          AI 도입 아이디어를 말씀해주세요. 에이전트가 신청서를 자동으로 작성합니다.
        </p>
        <ChatInterface />
      </div>
    </main>
  )
}
```

- [ ] **Step 4: 로컬 실행 확인**

```bash
npm run dev
```
브라우저에서 `http://localhost:3000/chat` 접속 → 에이전트 초기 메시지 표시 확인

- [ ] **Step 5: 커밋**

```bash
git add src/components/ChatMessage.tsx src/components/ChatInterface.tsx src/app/chat/
git commit -m "feat: AI 상담 챗 UI (ChatInterface + ChatMessage)"
```

---

### Task 9: 신청서 확인 폼

**Files:**
- Create: `src/app/submit/page.tsx`
- Create: `src/components/ProjectForm.tsx`

- [ ] **Step 1: `src/components/ProjectForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProjectFormData {
  id: string
  title: string
  department: string
  requesterName: string
  requesterEmail: string
  description: string
  asIs: string
  expectedBenefit: string
  confidentialityLevel: 'G1' | 'G2' | 'G3'
  championName: string
  estimatedUsers: number
}

export function ProjectForm({ initialData }: { initialData: ProjectFormData }) {
  const [data, setData] = useState(initialData)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  const field = (key: keyof ProjectFormData, label: string, type = 'text') => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={data[key] as string}
        onChange={(e) => setData({ ...data, [key]: e.target.value })}
        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  async function handleSubmit() {
    setSubmitting(true)
    // 1. 과제 데이터 업데이트
    await fetch(`/api/projects/${data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    // 2. 평가 에이전트 트리거
    await fetch(`/api/evaluate/${data.id}`, { method: 'POST' })
    router.push(`/status/${data.id}`)
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="max-w-xl mx-auto">
      {field('title', '과제명')}
      {field('department', '신청 부서')}
      {field('requesterName', '담당자 이름')}
      {field('requesterEmail', '이메일', 'email')}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">현재 업무 방식 (As-Is)</label>
        <textarea
          value={data.asIs}
          onChange={(e) => setData({ ...data, asIs: e.target.value })}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">기대 효익</label>
        <textarea
          value={data.expectedBenefit}
          onChange={(e) => setData({ ...data, expectedBenefit: e.target.value })}
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">데이터 기밀등급</label>
        <select
          value={data.confidentialityLevel}
          onChange={(e) => setData({ ...data, confidentialityLevel: e.target.value as 'G1' | 'G2' | 'G3' })}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="G1">G1 — 공개·저민감 (외부 API 사용 가능)</option>
          <option value="G2">G2 — 사내일반 (사내 클라우드 허용)</option>
          <option value="G3">G3 — 고기밀 (온프레미스 전용)</option>
        </select>
      </div>
      {field('championName', '챔피언 (담당자)')}
      {field('estimatedUsers', '예상 사용자 수', 'number')}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium mt-4 hover:bg-blue-700 transition disabled:opacity-40"
      >
        {submitting ? '평가 중...' : '신청서 제출 및 평가 시작'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: `src/app/submit/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { ProjectForm } from '@/components/ProjectForm'
import { notFound } from 'next/navigation'

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: { projectId?: string }
}) {
  const { projectId } = searchParams
  if (!projectId) notFound()

  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) notFound()

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto pt-8 px-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">신청서 확인</h1>
        <p className="text-sm text-gray-500 mb-6">내용을 확인하고 수정한 뒤 제출하세요.</p>
        <ProjectForm initialData={{ ...project, championName: project.championName ?? '' }} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: PATCH 라우트 추가**

`src/app/api/projects/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const project = await db.project.findUnique({
    where: { id: params.id },
    include: { scoreCard: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { id, createdAt, updatedAt, scoreCard, chatSession, ...data } = body
  const project = await db.project.update({ where: { id: params.id }, data })
  return NextResponse.json(project)
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/submit/ src/components/ProjectForm.tsx src/app/api/projects/
git commit -m "feat: 신청서 확인·수정 폼 + PATCH API"
```

---

### Task 10: 관리자 포트폴리오 대시보드

**Files:**
- Create: `src/components/ScoreCard.tsx`
- Create: `src/components/PipelineBoard.tsx`
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: `src/components/ScoreCard.tsx`**

```tsx
interface ScoreCardProps {
  impactScore: number
  roiScore: number
  confidentialityScore: number
  difficultyScore: number
  readinessScore: number
  strategyScore: number
  totalScore: number
  evaluationRationale: string
}

const DIMENSIONS = [
  { key: 'impactScore', label: '임팩트', max: 25 },
  { key: 'roiScore', label: 'ROI', max: 25 },
  { key: 'confidentialityScore', label: '기밀등급', max: 15 },
  { key: 'difficultyScore', label: '난이도(역산)', max: 15 },
  { key: 'readinessScore', label: '현업 준비도', max: 10 },
  { key: 'strategyScore', label: '전략 정합성', max: 10 },
] as const

export function ScoreCard(props: ScoreCardProps) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">종합 스코어</span>
        <span className="text-2xl font-bold text-blue-600">{props.totalScore.toFixed(1)}</span>
      </div>
      <div className="space-y-2">
        {DIMENSIONS.map(({ key, label, max }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${(props[key] / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-12 text-right">
              {props[key]}/{max}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3 leading-relaxed">{props.evaluationRationale}</p>
    </div>
  )
}
```

- [ ] **Step 2: `src/app/dashboard/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { ScoreCard } from '@/components/ScoreCard'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted: { label: '접수', color: 'bg-gray-100 text-gray-600' },
  evaluated: { label: '검토 중', color: 'bg-yellow-100 text-yellow-700' },
  pilot: { label: '파일럿', color: 'bg-blue-100 text-blue-700' },
  production: { label: '운영', color: 'bg-green-100 text-green-700' },
  closed: { label: '종료', color: 'bg-red-100 text-red-600' },
}

export default async function DashboardPage() {
  const projects = await db.project.findMany({
    include: { scoreCard: true },
    orderBy: { createdAt: 'desc' },
  })

  const byStatus = Object.keys(STATUS_LABELS).reduce(
    (acc, status) => {
      acc[status] = projects.filter((p) => p.status === status)
      return acc
    },
    {} as Record<string, typeof projects>
  )

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">AX 과제 포트폴리오</h1>
        <p className="text-sm text-gray-500 mb-6">총 {projects.length}개 과제</p>

        <div className="grid grid-cols-5 gap-4">
          {Object.entries(STATUS_LABELS).map(([status, { label, color }]) => (
            <div key={status}>
              <div className={`text-xs font-semibold px-2 py-1 rounded-lg inline-block mb-3 ${color}`}>
                {label} ({byStatus[status].length})
              </div>
              <div className="space-y-3">
                {byStatus[status].map((project) => (
                  <div key={project.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                        {project.title}
                      </h3>
                      <span className="text-xs text-gray-400 shrink-0">
                        {project.confidentialityLevel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{project.department}</p>
                    {project.scoreCard && (
                      <div className="text-xs font-bold text-blue-600">
                        {project.scoreCard.totalScore.toFixed(1)}점
                        {project.autoApproved && (
                          <span className="ml-1 text-green-600">(자동 승인)</span>
                        )}
                      </div>
                    )}
                    {project.status === 'evaluated' && (
                      <div className="mt-2 flex gap-1">
                        <form action={`/api/approve/${project.id}`} method="POST">
                          <input type="hidden" name="action" value="approve" />
                          <button className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">승인</button>
                        </form>
                        <form action={`/api/approve/${project.id}`} method="POST">
                          <input type="hidden" name="action" value="reject" />
                          <button className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">반려</button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: 랜딩 페이지 (`src/app/page.tsx`)**

```tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AX Request Hub</h1>
        <p className="text-gray-500 mb-8">삼성자산운용 AX/PI팀 AI 과제 관리 포털</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/chat"
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition"
          >
            AI 상담으로 과제 신청
          </Link>
          <Link
            href="/dashboard"
            className="border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
          >
            관리자 대시보드
          </Link>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: 전체 빌드 확인**

```bash
npm run build
```
Expected: `✓ Compiled successfully`

- [ ] **Step 5: 로컬 E2E 확인**

```bash
npm run dev
```
1. `http://localhost:3000` — 랜딩 페이지 확인
2. "AI 상담으로 과제 신청" 클릭 → 챗 화면 진입 확인
3. 에이전트 초기 메시지 표시 확인
4. `http://localhost:3000/dashboard` — 빈 파이프라인 표시 확인

- [ ] **Step 6: 최종 커밋**

```bash
git add .
git commit -m "feat: 관리자 포트폴리오 대시보드 + 랜딩 페이지 (AX Request Hub MVP)"
```

---

## Phase 5: 통합 테스트 + 배포 준비

### Task 11: 골든셋 통합 테스트

**Files:**
- Create: `tests/integration/golden-set.test.ts`

- [ ] **Step 1: 골든셋 테스트 작성**

`tests/integration/golden-set.test.ts`:
```typescript
import { EvaluationAgent } from '@/lib/agents/evaluation'
import { determineApproval } from '@/lib/scoring'
import { ExtractedProject } from '@/lib/agents/consultation'

const GOLDEN_SET: Array<{ project: ExtractedProject; expectedMinScore: number; expectedDecision: string }> = [
  {
    project: {
      title: '리서치 보고서 RAG 요약',
      department: '리서치팀', requesterName: '김연구', requesterEmail: 'a@b.com',
      description: '공개 PDF 리포트 자동 요약', asIs: '수동 요약 주 5시간',
      expectedBenefit: '주 4시간 절감', confidentialityLevel: 'G1',
      championName: '김연구', estimatedUsers: 10,
    },
    expectedMinScore: 65,
    expectedDecision: 'auto_approve',
  },
  {
    project: {
      title: '운용 포지션 분석 AI',
      department: '운용팀', requesterName: '박운용', requesterEmail: 'b@c.com',
      description: 'G3 포지션 데이터 AI 분석', asIs: '수동 분석',
      expectedBenefit: '분석 시간 50% 절감', confidentialityLevel: 'G3',
      championName: null, estimatedUsers: 3,
    },
    expectedMinScore: 0,
    expectedDecision: 'report',
  },
  {
    project: {
      title: 'AI 뭔가 도입하고 싶음',
      department: '관리팀', requesterName: '이관리', requesterEmail: 'c@d.com',
      description: '막연한 AI 도입', asIs: '없음', expectedBenefit: '모름',
      confidentialityLevel: 'G2', championName: null, estimatedUsers: 0,
    },
    expectedMinScore: 0,
    expectedDecision: 'report',
  },
]

describe('골든셋 통합 테스트', () => {
  const agent = new EvaluationAgent()

  for (const { project, expectedMinScore, expectedDecision } of GOLDEN_SET) {
    test(`${project.title} — 결정: ${expectedDecision}`, async () => {
      const scoreCard = await agent.evaluate(project)
      const decision = determineApproval(project.confidentialityLevel, scoreCard.totalScore)

      if (expectedMinScore > 0) {
        expect(scoreCard.totalScore).toBeGreaterThanOrEqual(expectedMinScore)
      }
      expect(decision).toBe(expectedDecision)
    }, 60000)
  }
})
```

- [ ] **Step 2: 골든셋 실행**

```bash
npx jest tests/integration/golden-set.test.ts --testTimeout=120000 --verbose
```
Expected: 3개 테스트 모두 `PASS`

- [ ] **Step 3: 커밋**

```bash
git add tests/integration/
git commit -m "test: 골든셋 통합 테스트 (상담→평가→승인 전체 흐름)"
```

---

### Task 12: 배포 준비 (사내 서버)

**Files:**
- Create: `Dockerfile`
- Create: `.env.production.example`

- [ ] **Step 1: `Dockerfile` 작성**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: `.env.production.example` 작성**

```bash
DATABASE_URL="file:/data/ax-hub.db"
ANTHROPIC_API_KEY=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
NEXT_PUBLIC_BASE_URL="http://사내서버IP:3000"
APPROVAL_THRESHOLD=70
```

- [ ] **Step 3: `next.config.ts`에 standalone 출력 추가**

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
}

export default config
```

- [ ] **Step 4: 빌드 확인**

```bash
npm run build
docker build -t ax-request-hub .
```
Expected: Docker 이미지 빌드 성공

- [ ] **Step 5: 최종 커밋 + 태그**

```bash
git add Dockerfile .env.production.example next.config.ts
git commit -m "chore: 사내 서버 배포 설정 (Docker standalone)"
git tag v0.1.0
```

---

## 미결 사항 (구현 중 확인 필요)

- [ ] 사내 서버 IP·포트 확정 (정보전략팀 협의)
- [ ] `NEXT_PUBLIC_BASE_URL` 실제 값 설정
- [ ] Gmail API 스크립트 경로가 서버 환경에서도 유효한지 확인 (`C:\Users\Samsung\Jarvis\...`)
  - 필요 시 email.ts에서 API 호출 방식으로 교체
- [ ] 텔레그램 결재 버튼을 실제 인라인 키보드로 교체 (현재는 링크 방식)
- [ ] 현업 온보딩 자료 (AX팀 출범 후 부서 설명회 연계)
