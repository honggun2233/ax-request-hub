# Task 1 Brief: WS-A — Snowflake 데이터 카탈로그 연동

## 목표
데이터플랫폼팀 Snowflake의 테이블/컬럼 메타데이터를 AX Hub DataAsset 테이블에 미러링한다.
실제 Snowflake 서버 연결은 불필요 — 연결 코드와 API 라우트만 구현한다.

## 작업 디렉토리
`/c/project/_cto/ax-hub/ax-request-hub/` (git worktree, 브랜치: feat/external-integrations)

## 현재 DataAsset 스키마 (prisma/schema.prisma 531번째 줄)
```prisma
model DataAsset {
  id             String    @id @default(cuid())
  name           String
  description    String
  ownerDept      String
  classification String    // DataClassification: G1|G2|G3
  schemaMeta     String?
  deliveryModes  String    // "API,FILE,DB"
  updateCycle    String?
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  requests       DataRequest[]
}
```

## 구현 사항

### 1. prisma/schema.prisma — DataAsset에 필드 추가
```prisma
model DataAsset {
  // 기존 필드 그대로 유지
  id             String    @id @default(cuid())
  name           String
  description    String
  ownerDept      String
  classification String
  schemaMeta     String?
  deliveryModes  String
  updateCycle    String?
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  requests       DataRequest[]

  // 신규 추가
  sourceSystem    String    @default("INTERNAL")  // INTERNAL | SNOWFLAKE | AWS_GLUE
  externalId      String?                          // Snowflake: DB.SCHEMA.TABLE
  syncedAt        DateTime?
  snowflakeDb     String?
  snowflakeSchema String?
}
```

### 2. Snowflake 라이브러리 설치
```bash
npm install snowflake-sdk
npm install --save-dev @types/snowflake-sdk
```
(워크트리 `/c/project/_cto/ax-hub/ax-request-hub/` 에서 실행)

### 3. lib/snowflake.ts 신규 작성
```typescript
// lib/snowflake.ts
// Snowflake INFORMATION_SCHEMA 조회 → DataAsset upsert

import snowflake from 'snowflake-sdk'
import { prisma } from '@/lib/prisma'

interface SnowflakeTable {
  TABLE_CATALOG: string
  TABLE_SCHEMA: string
  TABLE_NAME: string
  TABLE_TYPE: string
  COMMENT: string | null
}

export function getSnowflakeConnection(): snowflake.Connection {
  return snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USER!,
    password: process.env.SNOWFLAKE_PASSWORD!,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    role: process.env.SNOWFLAKE_ROLE ?? 'READONLY',
  })
}

export async function syncSnowflakeCatalog(): Promise<{ upserted: number }> {
  const conn = getSnowflakeConnection()
  // connect → query TABLES → query COLUMNS → DataAsset upsert
  // 구현 필요
  // 반환: { upserted: N }
}
```
- INFORMATION_SCHEMA.TABLES에서 TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE, COMMENT 조회
- 각 테이블에 대해 DataAsset upsert (externalId = `DB.SCHEMA.TABLE` 기준)
- name = TABLE_NAME, description = COMMENT || TABLE_NAME, ownerDept = 'DATA_PLATFORM'
- classification = 'G2' (기본), sourceSystem = 'SNOWFLAKE'
- deliveryModes = 'DB', syncedAt = now()

### 4. app/api/admin/catalog/sync/route.ts 신규 작성
```typescript
// POST /api/admin/catalog/sync
// AX_TEAM 또는 DATA_PLATFORM 역할 필요
import { requireRole } from '@/lib/authz'
import { syncSnowflakeCatalog } from '@/lib/snowflake'

export async function POST(request: Request) {
  const { error } = await requireRole('AX_TEAM', 'DATA_PLATFORM') ?? {}
  if (error) return error
  const result = await syncSnowflakeCatalog()
  return Response.json({ ok: true, ...result })
}
```

### 5. .env.example 신규 생성 (파일이 없으므로 새로 만듦)
```env
# ============================================================
# AX Hub 환경변수 예시 — 실제 값은 절대 git에 커밋하지 않는다
# ============================================================

# --- Database ---
DATABASE_URL=file:./dev.db

# --- NextAuth ---
NEXTAUTH_SECRET=change-me-in-production
NEXTAUTH_URL=http://localhost:3000

# --- Claude API ---
ANTHROPIC_API_KEY=sk-ant-...

# --- Snowflake 데이터 카탈로그 (WS-A) ---
SNOWFLAKE_ACCOUNT=your-account.ap-northeast-1
SNOWFLAKE_USER=ax_readonly
SNOWFLAKE_PASSWORD=your-snowflake-password
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=PROD_DB
SNOWFLAKE_ROLE=READONLY
```

### 6. Prisma 마이그레이션 실행
```bash
cd /c/project/_cto/ax-hub/ax-request-hub
npx prisma migrate dev --name add-snowflake-fields
```

## Global Constraints
- API 키 실제 값 절대 코드/git에 넣지 말 것
- TypeScript strict 준수, as any 사용 금지
- 기존 DataAsset 필드/관계 변경하지 말 것
- 권한 체크는 lib/authz.ts의 requireRole() 패턴 사용

## 리포트 파일
완료 후 결과를 `.superpowers/sdd/external-integrations/task-1-report.md`에 작성:
- 상태: DONE | DONE_WITH_CONCERNS | BLOCKED
- 커밋 해시
- 테스트 결과 1줄
- 우려 사항 (있으면)
