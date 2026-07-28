# Task 1 Report: Data API Routes

## Status: DONE

## Commit
Hash: 8f13b4e  
Branch: feat/registry-lifecycle-ui  
Message: feat(data): Data API 라우트 5종 추가

## Files Created
- `app/api/data/assets/route.ts` — GET (open, with search/filter) + POST (DATA_PLATFORM only)
- `app/api/data/assets/[id]/route.ts` — GET (open) + PATCH (DATA_PLATFORM only)
- `app/api/data/requests/route.ts` — GET (role-scoped) + POST (any authed user)
- `app/api/data/requests/[id]/route.ts` — GET (role-scoped) + PATCH (DATA_PLATFORM only, sets reviewerId)
- `app/api/data/provisions/route.ts` — POST (DATA_PLATFORM only, creates provision + sets request PROVISIONED)

## TypeScript Check Summary
2 pre-existing errors remain (not introduced by this task):
1. `app/api/admin/tools/[id]/route.ts` — old `{ params: { id: string } }` pattern (not a new file)
2. `docs/migrate-agents-v3.ts:131` — missing required fields in AgentRegistry create (migration script)

All 5 new route files are TypeScript-clean with Next.js 15 async params pattern (`Promise<{ id: string }>`).

---

## Code Review Fix Report (2026-07-23)

### Status: DONE

### Commit
Hash: e4f121b52c25f2625bff6ca4ea4fea16e8e27bdd  
Branch: feat/registry-lifecycle-ui  
Message: fix(data): 자산 PATCH 화이트리스트 필터 + provision에 reviewerId 누락 수정

### Files Changed
- `app/api/data/assets/[id]/route.ts` — Fix 1: replaced `data: body` with whitelist destructure + `Object.fromEntries` filter to remove undefined keys (mass assignment vulnerability)
- `app/api/data/provisions/route.ts` — Fix 2: extracted `userId` from session and added `reviewerId: userId` to `dataRequest.update` call

### TypeScript Check Result
`npx tsc --noEmit`: 2 pre-existing errors only (same as before fix — no new errors introduced):
1. `app/api/admin/tools/[id]/route.ts` — legacy params pattern
2. `docs/migrate-agents-v3.ts:131` — migration script missing AgentRegistry required fields

---

## Implementation Notes
- Used `@/lib/prisma` and `@/lib/auth` as specified
- Dynamic `[id]` routes use `Promise<{ id: string }>` params type (Next.js 15 requirement)
- DataRequest list: DATA_PLATFORM/AX_TEAM see all; others see only their own (by requesterId = session userId)
- DataRequest [id] GET: same role-based visibility with ownership check
- DataProvision POST: sequential writes — creates DataProvision then updates DataRequest.status to PROVISIONED
- All routes wrapped in try/catch returning `{ error: message }` with appropriate HTTP status codes
