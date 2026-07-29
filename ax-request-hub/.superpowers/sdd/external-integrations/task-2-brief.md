# Task 2 Brief: WS-B — LLM Usage API 배치 수집

## 목표
OpenAI + Gemini 실사용량을 UsageRecord 테이블에 자동 수집하는 배치 스크립트를 작성한다.

## 작업 디렉토리
`/c/project/_cto/ax-hub/ax-request-hub/` (git worktree, 브랜치: feat/external-integrations)

## 현재 UsageRecord 스키마 (prisma/schema.prisma 220번째 줄)
```prisma
model UsageRecord {
  id         String   @id @default(cuid())
  employeeId String
  employee   Employee @relation("EmployeeUsage", fields: [employeeId], references: [id])
  service    String
  yearMonth  String   // 포맷: 'YYYY-MM'
  tokenUsed  Int      @default(0)
  costKrw    Float    @default(0)
  inputById  String
  inputBy    Employee @relation("InputterUsage", fields: [inputById], references: [id])
  createdAt  DateTime @default(now())

  @@unique([employeeId, service, yearMonth])
}
```

## 중요: employeeId FK 처리
- UsageRecord는 employeeId가 Employee FK
- 조직 집계 데이터를 담을 'SYSTEM' employee가 없을 수 있음
- 스크립트 시작 시 SYSTEM employee upsert:
  ```typescript
  const systemEmployee = await prisma.employee.upsert({
    where: { email: 'system@ax-hub.internal' },
    update: {},
    create: {
      employeeId: 'SYSTEM',
      email: 'system@ax-hub.internal',
      name: 'System Batch',
      department: 'SYSTEM',
      role: 'EMPLOYEE',
      isActive: false,
    }
  })
  ```
  Employee 스키마 확인 후 필드 조정 필요

## 구현 사항

### scripts/collect-llm-usage.ts
```typescript
import { prisma } from '../lib/prisma'

async function ensureSystemEmployee(): Promise<string> {
  // SYSTEM employee upsert, employeeId 반환
}

async function collectOpenAIUsage(date: Date, systemEmployeeId: string): Promise<void> {
  // 환경변수: OPENAI_API_KEY, OPENAI_ORG_ID
  // API: GET https://api.openai.com/v1/organization/usage/completions
  // 파라미터: start_time, end_time (전일 unix timestamp)
  // UsageRecord upsert: service='ChatGPT', yearMonth='YYYY-MM'
  // tokenUsed = input_tokens + output_tokens (합산)
  // costKrw = 0 (원화 환산 미구현, 추후)
}

async function collectGeminiUsage(date: Date, systemEmployeeId: string): Promise<void> {
  // Google Cloud Billing API는 인증이 복잡
  // GOOGLE_APPLICATION_CREDENTIALS 없으면 stub으로 처리
  // console.warn으로 "Gemini 수집 미구현: GOOGLE_APPLICATION_CREDENTIALS 필요" 출력
  // 향후 구현을 위한 TODO 주석 남기기
}

async function main() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  
  const systemEmployeeId = await ensureSystemEmployee()
  await collectOpenAIUsage(yesterday, systemEmployeeId)
  await collectGeminiUsage(yesterday, systemEmployeeId)
  
  console.log('LLM usage collection complete')
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
```

### package.json scripts 추가
```json
"collect-usage": "ts-node -r tsconfig-paths/register scripts/collect-llm-usage.ts"
```
(tsconfig-paths/register: 절대경로 '@/' 지원. 이미 설치되어 있는지 확인)

### .env.example에 추가할 섹션 (Task 1이 이미 생성한 파일에 추가)
```env
# --- LLM Usage 수집 배치 (WS-B) ---
OPENAI_API_KEY=sk-org-...
OPENAI_ORG_ID=org-...
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 실행 방법 문서화
`scripts/README.md` 신규 작성:
```markdown
# Scripts

## collect-llm-usage.ts — LLM 사용량 수집

매일 전일 데이터를 OpenAI/Gemini API에서 수집해 UsageRecord에 저장한다.

### 수동 실행
```bash
npm run collect-usage
```

### 환경변수
- OPENAI_API_KEY: OpenAI organization-level API key
- OPENAI_ORG_ID: OpenAI organization ID
- GOOGLE_CLOUD_PROJECT: GCP project ID (Gemini용, 현재 미구현)
- GOOGLE_APPLICATION_CREDENTIALS: GCP service account JSON 경로 (Gemini용, 현재 미구현)
```

## Global Constraints
- 실제 API 키 절대 코드에 넣지 말 것
- .env 파일 git add 금지
- TypeScript strict 준수
- Employee 스키마 먼저 확인 후 SYSTEM upsert 코드 작성

## 체크 사항
- prisma/schema.prisma Employee 모델의 실제 필드 확인 필수
- tsconfig.json의 paths 설정 확인 (@ alias)
- ts-node가 설치되어 있는지 확인 (없으면 npx ts-node 사용)

## 리포트
완료 후 `/c/project/_cto/ax-hub/ax-request-hub/.superpowers/sdd/external-integrations/task-2-report.md`에 작성:
- 상태: DONE | DONE_WITH_CONCERNS | BLOCKED
- 커밋 해시
- tsc 결과 1줄
- 우려 사항
