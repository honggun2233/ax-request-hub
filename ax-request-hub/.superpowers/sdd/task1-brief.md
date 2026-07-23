# Task 1: Data API Routes

## Context
AX Hub (Next.js 14 App Router, Prisma + SQLite, NextAuth). v3 migration added DataAsset / DataRequest / DataProvision models to prisma/schema.prisma. You must create all backend API routes for these.

## Auth Pattern (MUST match existing routes exactly)
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

const session = await getServerSession(authOptions)
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const role = (session.user as any)?.role
const userId = (session.user as any)?.id
const userEmail = (session.user as any)?.email
```

## DataRequest Status flow
REQUESTED → REVIEWING → SEC_REVIEW → APPROVED → COLLECTING → PROVISIONED
                                   → REJECTED (from any state)

## Files to create

### app/api/data/assets/route.ts
- GET: DataAsset 목록
  - Query params: search (name/description LIKE), classification (G1/G2/G3), ownerDept, isActive (default: true)
  - No auth required (open read)
  - Returns: array of DataAsset with request count
- POST: DataAsset 등록
  - Auth: DATA_PLATFORM role only
  - Body: { name, description, ownerDept, classification, deliveryModes, updateCycle?, schemaMeta? }
  - Returns: created DataAsset, 201

### app/api/data/assets/[id]/route.ts
- GET: 단건 상세 (no auth)
  - Include: requests count
- PATCH: 수정 (DATA_PLATFORM only)
  - Body: partial DataAsset fields
  - Returns: updated DataAsset

### app/api/data/requests/route.ts
- GET: DataRequest 목록
  - If role is DATA_PLATFORM or AX_TEAM: return all requests with project + asset info
  - Otherwise: return only requests where requesterId === userId
  - Query params: status (filter)
  - Include: asset { name, classification }, project { title }
- POST: DataRequest 신청
  - Auth: any logged-in user
  - Body: { type, projectId, assetId?, agentId?, purpose, classification, periodMonths, requestedSpec?, forProduction? }
  - Set requesterId = userId (from session)
  - Returns: created DataRequest, 201

### app/api/data/requests/[id]/route.ts
- GET: 단건 조회
  - Auth: logged in; DATA_PLATFORM/AX_TEAM sees all, others only own
  - Include: asset, project, provision
- PATCH: 상태 변경
  - Auth: DATA_PLATFORM only
  - Body: { status, rejectReason? }
  - Set reviewerId = userId
  - Returns: updated DataRequest

### app/api/data/provisions/route.ts
- POST: 제공 처리
  - Auth: DATA_PLATFORM only
  - Body: { requestId, deliveryMode, connectionRef, expiresAt }
  - Also update DataRequest.status = 'PROVISIONED'
  - Returns: created DataProvision, 201

## Notes
- Use `@/lib/prisma` (not `@/src/lib/db`)
- Use `@/lib/auth` for authOptions
- No transactions needed (simple sequential writes are fine)
- Error handling: try/catch returning { error: message } with appropriate status

## Report file
Write full report to: C:/project/ax-team/ax-request-hub/.superpowers/sdd/task1-report.md
Return: status (DONE/BLOCKED), commit hash, one-line test summary, any concerns.
