# AX Hub 외부 연동 개발 계획 (2026-07-29)

## 컨텍스트
- 레포: `/c/project/_cto/ax-hub/ax-request-hub/` (워크트리, 브랜치: feat/external-integrations)
- 원본 저장소: `/c/project/ax-team/ax-request-hub/` (master)
- 아키텍처 설계서: docs/architecture/architecture_v3_통합본.md §23

## Global Constraints
- 실제 API 키 값 절대 금지 — .env.example에 placeholder만
- G3 기밀 데이터를 외부 AI 서비스에 입력 금지
- .env 파일 git add 절대 금지
- TypeScript strict 준수
- 기존 코드 스타일 유지

## Task 1: WS-A — Snowflake 데이터 카탈로그 연동

### 목표
데이터플랫폼팀 Snowflake의 테이블/컬럼 메타데이터를 DataAsset 테이블에 미러링

### 작업 목록
1. prisma/schema.prisma의 DataAsset 모델에 컬럼 추가:
   - sourceSystem String @default("INTERNAL")  // INTERNAL | SNOWFLAKE | AWS_GLUE
   - externalId   String?                       // Snowflake: DB.SCHEMA.TABLE
   - syncedAt     DateTime?
   - snowflakeDb  String?
   - snowflakeSchema String?
2. Snowflake 라이브러리 설치: snowflake-sdk (npm install snowflake-sdk @types/snowflake-sdk --save-dev)
3. lib/snowflake.ts 작성:
   - SnowflakeConfig 타입
   - getSnowflakeConnection() — 환경변수에서 설정 읽기
   - syncSnowflakeCatalog() — INFORMATION_SCHEMA.TABLES + COLUMNS 조회 → DataAsset upsert
4. app/api/admin/catalog/sync/route.ts 작성:
   - POST 핸들러
   - ADMIN 역할 체크 (lib/authz.ts 패턴 참조)
   - syncSnowflakeCatalog() 호출
   - 결과 반환 (동기화된 asset 수)
5. .env.example에 추가:
   ```
   SNOWFLAKE_ACCOUNT=your-account.region
   SNOWFLAKE_USER=ax_readonly
   SNOWFLAKE_PASSWORD=your-password
   SNOWFLAKE_WAREHOUSE=COMPUTE_WH
   SNOWFLAKE_DATABASE=PROD_DB
   SNOWFLAKE_ROLE=READONLY
   ```
6. npx prisma migrate dev --name add-snowflake-fields (워크트리에서 실행)

## Task 2: WS-B — LLM Usage API 배치 수집

### 목표
OpenAI + Gemini 실사용량을 UsageRecord 테이블에 자동 수집

### 현재 상태
UsageRecord 스키마: employeeId, service, yearMonth, tokenUsed, costKrw
Claude는 /api/chat에서 실시간 누적 중. GPT/Gemini는 UI만 있고 실수집 없음.

### 작업 목록
1. scripts/collect-llm-usage.ts 작성:
   - collectOpenAIUsage(date: Date): Promise<void>
     - GET https://api.openai.com/v1/organization/usage/completions (Bearer OPENAI_API_KEY)
     - start_time/end_time: 전일 unix timestamp
     - UsageRecord upsert: service='ChatGPT', employeeId='SYSTEM', yearMonth='YYYY-MM'
   - collectGeminiUsage(date: Date): Promise<void>
     - Google Cloud Billing API 또는 직접 API 불가 시 stub + 주석으로 대체
     - UsageRecord upsert: service='Gemini', employeeId='SYSTEM', yearMonth='YYYY-MM'
   - main(): 어제 날짜로 두 함수 호출
2. 환경변수 추가 (.env.example):
   ```
   OPENAI_API_KEY=sk-org-...
   OPENAI_ORG_ID=org-...
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```
3. package.json scripts에 추가: "collect-usage": "ts-node scripts/collect-llm-usage.ts"
4. 실행 방법: README 또는 scripts/README.md에 간략 문서화

### 주의
- UsageRecord.employeeId는 FK (Employee 테이블). 'SYSTEM'이라는 employee가 없을 수 있음.
  → SYSTEM employee가 없으면 upsert 전 ensure 처리 (없으면 생성)
- yearMonth 포맷: 'YYYY-MM' (기존 UsageRecord 패턴 따름)

## Task 3: WS-C — Samsung Knox 알림 연동

### 목표
기존 lib/notify.ts의 인앱 알림을 Knox 사내 채널 알림으로 확장 (기존 기능 유지)

### 현재 상태
lib/notify.ts: notify(recipientEmail, title, body, link?) — DB 인앱 알림 생성만
Telegram 없음. Knox 없음.

### 작업 목록
1. lib/notify.ts 전면 재작성 (기존 인앱 알림 기능 유지 + Knox 추가):
   - NotifyEvent 타입:
     ```typescript
     type NotifyEventType = 
       | 'TASK_ESCALATED'
       | 'GATE_TRANSITION'
       | 'DATA_REQUEST_UPDATE'
       | 'TOKEN_WARNING'
       | 'TOKEN_EXCEEDED'
       | 'COUNCIL_READY'
       | 'AGENT_SUSPENDED'
     
     interface NotifyEvent {
       type: NotifyEventType
       title: string
       body: string
       link?: string
       metadata?: Record<string, unknown>
     }
     ```
   - sendKnoxNotification(event: NotifyEvent, recipients: string[]): Promise<void>
     - POST ${KNOX_API_ENDPOINT}/notify/send
     - Header: Authorization: Bearer ${KNOX_API_KEY}, X-Sender-Id: ${KNOX_SENDER_ID}
     - Body: { recipients, subject: event.title, message: event.body, link: event.link }
   - notify(event: NotifyEvent | string, recipients: string[], opts?): Promise<void>
     - NOTIFY_CHANNEL=knox → sendKnoxNotification()
     - NOTIFY_CHANNEL=console (기본/dev) → console.log()
     - 기존 인앱 알림(DB)도 항상 생성 (기존 호출 호환)
   - 하위 호환: 기존 notify(recipientEmail, title, body, link?) 시그니처도 지원

2. 기존 알림 호출 위치에 Knox 이벤트 타입 주입:
   - 에스컬레이션 발생 위치 (app/api/ 내 scoring/escalation 관련)
   - Gate 전환 위치
   - 토큰 경고 위치 (UsageAlert 생성 위치)

3. 환경변수 추가 (.env.example):
   ```
   NOTIFY_CHANNEL=console
   KNOX_API_ENDPOINT=https://knox-internal.example.com/api/v1
   KNOX_API_KEY=your-knox-api-key
   KNOX_SENDER_ID=ax-team
   ```

## Task 4: WS-D — PostgreSQL 전환 + 온프레미스 배포 준비

### 목표
SQLite → PostgreSQL 전환 준비 및 온프레미스 배포 스크립트 작성
실제 PostgreSQL 서버 없음 — 코드/스크립트만 준비

### 작업 목록
1. prisma/schema.prisma: datasource provider "sqlite" → "postgresql"
   - DATABASE_URL placeholder로 변경
   - 기존 schema.prisma.bak은 SQLite 백업으로 유지
2. prisma migrate dev 실행 불가 (PostgreSQL 서버 없음) → 스킵
   - 대신 주석으로 실행 방법 명시
3. next.config.ts에 output: 'standalone' 추가
4. scripts/deploy.sh 작성:
   ```bash
   #!/bin/bash
   set -e
   git pull origin main
   npm ci
   npx prisma migrate deploy
   npm run build
   pm2 restart ax-hub || pm2 start npm --name ax-hub -- start
   ```
5. .env.example에 추가:
   ```
   DATABASE_URL=postgresql://ax_user:password@localhost:5432/ax_hub
   ```
6. docs/deployment.md 작성:
   - 사전 요구사항 (Node.js 20, PM2, PostgreSQL 16, Nginx)
   - PM2 설정 예시 (ecosystem.config.js)
   - Nginx 설정 예시
   - 환경변수 목록
   - 초기 배포 및 업데이트 절차
