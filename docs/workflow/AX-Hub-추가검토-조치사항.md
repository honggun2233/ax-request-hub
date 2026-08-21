# AX Hub 추가 검토 및 조치 사항

**대상**: 삼성자산운용 AX Request Hub (Next.js 16 + Prisma 5 + SQLite)
**검토 범위**: `ax-hub-code-review-v2.md` (누락 파일 보강분 12개)
**작성일**: 2026-08-11
**선행 문서**: 1차 리뷰 (schema.prisma, auth.ts, authz.ts, registry API/page, projects API, login, dashboard, layout, prisma.ts, next.config.ts)

---

## 0. 요약

v2 번들로 **12개 파일을 추가 확인**했고, 신규 이슈 **17건**을 발견했습니다.
동시에 1차 리뷰에서 "확인 불가"로 남겨둔 항목 중 **4건이 확정**, **1건이 정정**되었습니다.

| 구분 | 건수 | 비고 |
|---|---|---|
| 🔴 Critical (배포 차단) | 3 | 무인증 API 1건, 승인 절차 우회 2건 |
| 🟠 High (2주 내) | 6 | 인증 패턴 분열, 트랜잭션 부재, 의존성 취약점 |
| 🟡 Medium (1개월 내) | 8 | 테스트 인프라, 권한-네비게이션 불일치, 설정 |
| ⚫ 여전히 확인 불가 | 6 | **`middleware.ts` 포함** |

> **가장 중요한 결론**: `middleware.ts`가 v2에도 포함되지 않아, 1차 리뷰의 최우선 지적(`/dashboard` 무인증 노출)이 **아직 판정 불가** 상태입니다. 여기에 이번에 `/api/ax-projects`도 무인증임이 확인되어, 두 건 모두 즉시 확인이 필요합니다.

---

## 1. 확인 결과 — 파일별

| 파일 | 상태 | 결과 |
|---|---|---|
| `app/api/approve/[id]/route.ts` | ✅ 확인 | 신규 이슈 5건 (승인 절차 우회 포함) |
| `app/api/registry/links/route.ts` | ✅ 확인 | 신규 이슈 3건 |
| `app/api/ax-projects/route.ts` | ✅ 확인 | **🔴 인증 없음** |
| `src/lib/db.ts` | ✅ 확인 | Prisma 이중화 확정 — 운영/개발 동작 상이 |
| `components/app-sidebar.tsx` | ✅ 확인 | 권한-네비게이션 불일치 2건 |
| `app/providers.tsx` | ✅ 확인 | 특이사항 없음 (에러 바운더리 부재만) |
| `.env.example` | ✅ 확인 | 시크릿 관리 개선 필요, PG 전환 계획 확인됨 |
| `package.json` | ✅ 확인 | **test 스크립트 누락**, `xlsx` 취약점, 의존성 분류 오류 |
| `jest.config.ts` | ✅ 확인 | 설정 불일치 3건 |
| `tests/api/chat.test.ts` | ✅ 확인 | 거버넌스 로직 테스트 0건 |
| `tests/lib/scoring.test.ts` | ✅ 확인 | 실명 하드코딩, 런타임 우회 가능 |
| `middleware.ts` | ❌ **미제공** | **최우선 확인 대상** |

---

## 2. 신규 발견 이슈

### 🔴 C-1. `/api/ax-projects` 인증 전무

**파일**: `app/api/ax-projects/route.ts`

```ts
export async function GET() {
  const projects = await prisma.aXProject.findMany({
    include: { agents: { include: { agent: { select: {
      agentName: true, lifecycleStage: true, fallbackRate: true,
      gate1Passed: true, gate2Passed: true, gate3Passed: true, owner: true,
    }}}}},
  })
  return NextResponse.json({ projects })   // ← requireRole() 호출 없음
}
```

`requireRole()`도 `getServerSession()`도 없습니다. 전사 AI 프로젝트 목록, 소속 에이전트, **게이트 통과 현황과 fallback율(내부 성능 지표)** 이 미인증 상태로 전부 노출됩니다.

`/dashboard` 페이지에 이어 **두 번째 무인증 접점**이며, 이 시스템에서 인증 누락이 단발 실수가 아니라 패턴임을 보여줍니다.

**조치**
```ts
export async function GET() {
  const auth = await requireRole()          // 로그인 필수
  if ('error' in auth) return auth.error
  // ... 이하 동일
}
```
> 추가로, 일반 직원에게 전사 에이전트 성능 지표를 공개할지 정책 결정이 필요합니다. 필요 시 `requireRole('AX_TEAM','C_LEVEL','EXECUTIVE')`로 제한하고, 일반 직원용은 별도 필드 축소 응답을 제공하세요.

---

### 🔴 C-2. 승인 API가 점수 평가를 전혀 검증하지 않음

**파일**: `app/api/approve/[id]/route.ts`

```ts
const project = await db.project.findUnique({ where: { id } })
if (!project) return NextResponse.json({ error: '...' }, { status: 404 })
const statusMap = { approve: 'pilot', hold: 'evaluated', reject: 'closed' } as const
await db.project.update({ where: { id }, data: { status: statusMap[action], ... } })
```

검증되지 않는 항목:

1. **`ScoreCard` 존재 여부** — 평가를 한 번도 거치지 않은 `submitted` 과제를 바로 `pilot`으로 승인할 수 있습니다.
2. **현재 상태(`project.status`)** — 이미 `closed`(반려)된 과제나 `production` 과제를 다시 승인 처리할 수 있습니다. 멱등성이 없어 재호출 시 데이터 신청 상태 전환과 승인 메일이 중복 발송됩니다.
3. **기밀등급(G3) 규칙** — `tests/lib/scoring.test.ts`는 "G3 과제는 점수 무관 항상 보고"를 검증하지만, **이 API는 `confidentialityLevel`을 읽지도 않습니다.** 테스트가 통과하는 로직과 실제 승인 경로가 분리돼 있습니다.

여기에 1차 리뷰의 `POST /api/projects` mass assignment(클라이언트가 `status: 'production'` 지정 가능)를 합치면, **평가·승인 게이트는 두 개의 독립적인 경로로 우회 가능**합니다.

**조치**
```ts
const project = await db.project.findUnique({
  where: { id }, include: { scoreCard: true },
})
if (!project) return NextResponse.json({ error: '과제를 찾을 수 없습니다.' }, { status: 404 })

// 1) 승인 가능 상태 검증
if (!['submitted', 'evaluated'].includes(project.status)) {
  return NextResponse.json(
    { error: `이미 처리된 과제입니다. (현재: ${project.status})` }, { status: 409 })
}
// 2) 평가 완료 검증
if (action === 'approve' && !project.scoreCard) {
  return NextResponse.json(
    { error: '평가(ScoreCard)가 완료되지 않은 과제는 승인할 수 없습니다.' }, { status: 400 })
}
// 3) G3 규칙 — scoring.ts의 determineApproval과 동일 기준 재사용
if (action === 'approve' && project.confidentialityLevel === 'G3'
    && !isAuthorizedForG3(auth.user.role)) {
  return NextResponse.json({ error: 'G3 과제는 별도 승인 권한이 필요합니다.' }, { status: 403 })
}
```

---

### 🔴 C-3. `action` 파라미터 미검증 → 조용한 데이터 오염

**파일**: `app/api/approve/[id]/route.ts`

```ts
const { action, note }: { action: 'approve'|'hold'|'reject'; note?: string } = await req.json()
const statusMap = { approve: 'pilot', hold: 'evaluated', reject: 'closed' } as const
await db.project.update({ where: { id }, data: {
  status: statusMap[action],                    // ← 미정의 값이면 undefined
  approvedBy: ...,  decisionNote: note ?? null,
}})
```

TypeScript 타입 주석은 **런타임에 아무 역할을 하지 않습니다.** `action: "xyz"`를 보내면 `statusMap[action]`이 `undefined`가 되고, Prisma는 `undefined` 필드를 **무시**합니다. 결과:

- `status`는 그대로 유지 (변경 안 됨)
- **그러나 `approvedBy`와 `decisionNote`는 덮어써짐**
- 응답은 `{ ok: true, status: undefined }` — 클라이언트는 성공으로 인식

즉 **승인되지 않은 과제에 승인자 이름이 기록되는** 상태가 만들어집니다. 감사 추적 관점에서 치명적입니다.

**조치**
```ts
const VALID_ACTIONS = ['approve', 'hold', 'reject'] as const
const body = await req.json()
if (!VALID_ACTIONS.includes(body.action)) {
  return NextResponse.json({ error: 'action은 approve|hold|reject 중 하나여야 합니다.' }, { status: 400 })
}
```
> 근본 해결은 zod 도입입니다. 1차 리뷰에서 지적한 `/api/projects`, `/api/registry`의 mass assignment와 같은 뿌리이므로 **전체 API에 일괄 적용**을 권장합니다.

---

### 🟠 H-1. 인증 패턴이 3가지로 분열 — 권한 회수가 최대 30일 지연

현재 코드베이스에 인증 방식이 세 가지 공존합니다.

| 패턴 | 사용처 | role 출처 | `isActive` 확인 |
|---|---|---|---|
| `requireRole()` | `/api/registry`, `/api/projects` | **DB 재조회** | ✅ |
| 인라인 `getServerSession` | `/api/approve`, `/api/registry/links` | **JWT (로그인 시점 고정)** | ❌ |
| 없음 | `/api/ax-projects`, `/dashboard` | — | ❌ |

```ts
// approve/[id]/route.ts, registry/links/route.ts — JWT의 role을 그대로 신뢰
if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any)?.role)) { ... }
```

`auth.ts`의 세션 전략은 `strategy: "jwt"`이고 `maxAge` 설정이 없어 **기본 30일**입니다. 따라서:

- **퇴사자·부서이동자·권한 회수 대상자가 최대 30일간 과제 승인 권한을 유지**합니다.
- `Employee.isActive = false`로 바꿔도 이 두 API는 막지 못합니다.
- `authz.ts`가 `isActive`를 확인하도록 잘 설계돼 있는데, 정작 가장 민감한 승인 API가 그걸 우회합니다.

**조치**
1. `/api/approve/[id]`, `/api/registry/links`를 `requireRole()`로 전환
   ```ts
   const auth = await requireRole('AX_TEAM', 'C_LEVEL')
   if ('error' in auth) return auth.error
   // auth.user.role, auth.user.email 사용
   ```
2. `auth.ts`에 세션 만료 단축: `session: { strategy: "jwt", maxAge: 8 * 60 * 60 }` (8시간)
3. ESLint 규칙 또는 코드리뷰 체크리스트로 **API 라우트에서 `getServerSession` 직접 호출 금지** 명문화

---

### 🟠 H-2. 승인 처리에 트랜잭션·에러 처리 없음

**파일**: `app/api/approve/[id]/route.ts`

```ts
await db.project.update({ ... })                      // ① 커밋됨
const draftCount = await db.dataRequest.updateMany({  // ② 커밋됨
  where: { projectId: id, status: 'DRAFT' }, data: { status: 'PENDING' },
})
await sendApprovalEmail({ ... })                      // ③ 실패 시 여기서 throw
return NextResponse.json({ ok: true, ... })
```

`try/catch`가 전혀 없습니다. 메일 발송(③)이 실패하면:
- 클라이언트는 500을 받아 **승인 실패로 인식**
- 그러나 DB는 이미 `pilot` + `PENDING` 상태로 **승인 완료**
- 재시도하면 C-2의 멱등성 부재와 겹쳐 이중 처리

**조치**
```ts
const result = await db.$transaction(async (tx) => {
  await tx.project.update({ ... })
  const draft = action === 'approve'
    ? await tx.dataRequest.updateMany({ where: { projectId: id, status: 'DRAFT' }, data: { status: 'PENDING' } })
    : { count: 0 }
  await tx.auditLog.create({ data: {
    entityType: 'Project', entityId: id, action: `APPROVAL_${action.toUpperCase()}`,
    actorEmail: auth.user.email, detail: JSON.stringify({ note, from: project.status, to: statusMap[action] }),
  }})
  return draft.count
})

// 메일은 트랜잭션 밖에서, 실패해도 승인은 유효하게
try { await sendApprovalEmail({ ... }) }
catch (e) { console.error('[approve] 메일 발송 실패', id, e) }

return NextResponse.json({ ok: true, status: statusMap[action], dataRequestsActivated: result })
```

> `AuditLog` 모델은 스키마에 존재하지만 **전 코드베이스에서 쓰기 호출이 0건**입니다(1차 리뷰 지적). 승인은 가장 우선적으로 기록해야 할 이벤트이므로 위 예시에 포함했습니다.

---

### 🟠 H-3. Prisma 클라이언트 — 개발/운영 동작이 다름

**파일**: `src/lib/db.ts`, `lib/prisma.ts`

두 파일이 **동일한 `globalThis.prisma` 키를 공유**합니다.

```ts
// 양쪽 모두
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; prismaVer?: number }
const SCHEMA_VER = 6   // ← 양쪽에 중복 정의
```

동작 추적 결과:

| 환경 | 결과 | 원인 |
|---|---|---|
| 개발 | 인스턴스 **1개 공유** | `globalThis.prisma`에 할당되어 두 번째 모듈이 재사용 |
| 운영 | 인스턴스 **2개 생성** | `NODE_ENV === 'production'`이면 global에 할당하지 않음 |

즉 **운영에서만 커넥션이 2배**가 되고, 개발에서는 재현되지 않습니다. 로그 설정도 서로 달라(`log: ['error']` vs 조건부) 운영 진단 시 혼선이 생깁니다.

또한 `SCHEMA_VER = 6`이 두 파일에 하드코딩돼 있어, 스키마 변경 시 **한쪽만 올리면 개발 환경 캐시가 어긋납니다.**

**조치 (근본 원인 포함)**
1. `src/lib/db.ts`를 삭제하고 `lib/prisma.ts`로 일원화, `export { prisma as db }`로 기존 import 호환 유지 후 점진 교체
2. `SCHEMA_VER` 해킹 제거 — 이 우회책의 원인은 `prisma generate`가 빌드 파이프라인에 없기 때문입니다
   ```jsonc
   // package.json
   "scripts": {
     "postinstall": "prisma generate",
     "build": "prisma generate && next build"
   }
   ```
3. 정리 후 표준 싱글턴으로 축소
   ```ts
   const g = globalThis as unknown as { prisma?: PrismaClient }
   export const prisma = g.prisma ?? new PrismaClient({ log: ['error'] })
   if (process.env.NODE_ENV !== 'production') g.prisma = prisma
   ```

---

### 🟠 H-4. `xlsx@0.18.5` — 알려진 보안 취약점

**파일**: `package.json`

```json
"xlsx": "^0.18.5"
```

npm 레지스트리의 `xlsx` 0.18.5는 **Prototype Pollution(CVE-2023-30533)** 및 **ReDoS(CVE-2024-22363)** 취약점이 보고된 버전입니다. SheetJS는 npm 배포를 중단했고, 수정본은 자체 CDN(`https://cdn.sheetjs.com`)에서만 제공됩니다.

금융회사 내부 시스템에서 **사용자가 업로드한 엑셀을 파싱**하는 경로가 있다면 즉시 대응이 필요합니다.

**조치 (택1)**
- SheetJS CDN 버전으로 교체: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- 또는 유지보수 중인 대안으로 전환: `exceljs`
- 파싱 대상이 내부 생성 파일뿐이라면 위험도를 재평가하되, 보안팀에 예외 승인 기록을 남길 것

**동시 조치**: `@types/xlsx@^0.0.35`는 `xlsx`가 자체 타입을 포함하므로 **불필요하며 오히려 타입 충돌을 유발**합니다. 제거하세요.

---

### 🟠 H-5. `bcryptjs`가 설치돼 있으나 사용되지 않음

**파일**: `package.json` vs `lib/auth.ts`

```json
"bcryptjs": "^3.0.3",
"@types/bcryptjs": "^2.4.6",
```

`Employee.password` 필드(스키마), `bcryptjs` 의존성(package.json), 로그인 폼(login/page.tsx)까지 **비밀번호 인증에 필요한 부품이 전부 갖춰져 있는데, `auth.ts`의 `authorize()`는 이를 하나도 사용하지 않습니다.**

1차 리뷰의 최대 이슈(입력값 무시 후 무조건 AX_TEAM 로그인)가 "설계 누락"이 아니라 **"구현 중단"** 이었음이 확인됩니다. 즉 조치 난이도가 낮습니다.

**조치**
```ts
async authorize(credentials) {
  if (!credentials?.email || !credentials?.password) return null
  const employee = await db.employee.findUnique({ where: { email: credentials.email } })
  if (!employee || !employee.isActive || !employee.password) return null
  const ok = await bcrypt.compare(credentials.password, employee.password)
  if (!ok) return null
  return { id: employee.id, email: employee.email, name: employee.name,
           role: employee.role, currentLevel: employee.currentLevel, department: employee.department }
}
```
- `prisma/seed.ts`에서 데모 계정 5종의 비밀번호를 `bcrypt.hash()`로 생성해 저장
- `login/page.tsx`의 하드코딩된 `password: "internal"`은 시연용 임시 비밀번호로 대체하되, **운영 배포 전 반드시 제거**
- `Employee.password`의 `@default("")` 제거 → `String?`로 변경 (빈 문자열 해시는 검증을 우회할 여지가 있음)

---

### 🟠 H-6. `/api/registry/links` — 존재하지 않는 ID에 대한 처리 없음

**파일**: `app/api/registry/links/route.ts`

```ts
const link = await prisma.agentProjectLink.upsert({
  where: { agentId_projectId: { agentId, projectId } },
  update: { role }, create: { agentId, projectId, role },
  include: { project: true },
})
```

- `try/catch` 없음 → 잘못된 `agentId`/`projectId`는 **FK 위반으로 처리되지 않은 500**
- `DELETE`에서 없는 링크 삭제 시 Prisma `P2025` → 동일하게 500
- `role`이 `PRIMARY|SUPPORTING|EXPERIMENTAL`로 검증되지 않음 → 임의 문자열 저장 가능 (UI의 `ROLE_LABEL` 매핑이 깨짐)
- `AuditLog` 미기록

**조치**
```ts
const VALID_ROLES = ['PRIMARY', 'SUPPORTING', 'EXPERIMENTAL']
if (!VALID_ROLES.includes(role)) {
  return NextResponse.json({ error: 'role 값이 올바르지 않습니다.' }, { status: 400 })
}
try {
  const link = await prisma.agentProjectLink.upsert({ ... })
  return NextResponse.json(link, { status: 201 })
} catch (e) {
  if ((e as any).code === 'P2003') {
    return NextResponse.json({ error: '에이전트 또는 프로젝트를 찾을 수 없습니다.' }, { status: 404 })
  }
  console.error('[registry/links] POST 실패', e)
  return NextResponse.json({ error: '링크 처리 중 오류가 발생했습니다.' }, { status: 500 })
}
```
`DELETE`도 `P2025`를 404로 변환하세요.

---

### 🟡 M-1. C_LEVEL은 승인 권한이 있으나 접근할 화면이 없음

**파일**: `components/app-sidebar.tsx` vs `app/api/approve/[id]/route.ts`

```ts
// approve API — C_LEVEL 승인 허용
if (!['AX_TEAM', 'C_LEVEL'].includes(role)) return 403
```
```tsx
// 사이드바 — C_LEVEL에게는 /executive 하나만 노출
{ title: "경영 현황", roles: ["EXECUTIVE", "C_LEVEL"], items: [{ href: "/executive", ... }] }
// /admin(심사 관리), /dashboard는 roles: ["AX_TEAM"] 전용
```

**C_LEVEL 사용자는 승인 API를 호출할 권한이 있지만, 승인 버튼이 있는 화면(`/dashboard`, `/admin`)으로 가는 메뉴가 없습니다.** URL을 직접 입력해야만 도달 가능합니다.

추가로 `schema.prisma` 주석은 `EXECUTIVE ← C_LEVEL 상위 집합`이라고 정의하는데, 승인 API는 `EXECUTIVE`를 제외합니다. **문서·스키마·API·UI 4곳의 역할 정의가 서로 다릅니다.**

**조치**
1. 역할별 권한 매트릭스를 문서 1장으로 확정 (아래 표를 초안으로 사용)
2. `lib/authz.ts`에 권한 상수를 정의하고 API·사이드바가 **동일 상수를 참조**하도록 변경

| 기능 | EMPLOYEE | DEPT_HEAD | DATA_PLATFORM | C_LEVEL | EXECUTIVE | AX_TEAM |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| 과제 신청 / 내 현황 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 부서 도구 배정 | | ✅ | | | | ✅ |
| 데이터 신청 심사 | | | ✅ | | | ✅ |
| 과제 승인 | | | | **?** | **?** | ✅ |
| 에이전트 게이트 전환 | | | | | | ✅ |
| 경영 대시보드 | | | | ✅ | ✅ | ✅ |

> **?** 표시 항목은 의사결정이 필요합니다. 현재 코드는 C_LEVEL 허용 / EXECUTIVE 불허인데 의도와 일치하는지 확인하세요.

---

### 🟡 M-2. 사이드바 메뉴 중복 정의로 인한 드리프트 위험

**파일**: `components/app-sidebar.tsx`

`/dept/tools`와 `/dp/requests`가 각 역할 그룹과 AX_TEAM 그룹에 **각각 하드코딩**되어 총 2회씩 등장합니다. 라벨이 한쪽만 바뀌면 역할에 따라 다른 이름으로 보이게 됩니다(실제로 `/dept/tools`는 "도구 배정", 아이콘은 `Users` vs `Wrench`로 이미 불일치).

**조치**: 메뉴를 `href` 기준 단일 정의 + `roles: Role[]` 속성으로 전환

```tsx
const NAV_ITEMS = [
  { href: "/dept/tools", label: "도구 배정", icon: Wrench, roles: ["DEPT_HEAD", "AX_TEAM"] },
  { href: "/dp/requests", label: "데이터 승인", icon: Database, roles: ["DATA_PLATFORM", "AX_TEAM"] },
  // ...
]
```

---

### 🟡 M-3. `npm test`가 실행되지 않음

**파일**: `package.json`, `jest.config.ts`

Jest·ts-jest·testing-library가 모두 설치되고 `jest.config.ts`도 작성돼 있으나, **`scripts`에 `test` 항목이 없습니다.** 현재 테스트를 실행할 표준 명령이 없어 CI 연결이 불가능합니다.

```jsonc
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "typecheck": "tsc --noEmit"
}
```

**추가 설정 문제 3건**
1. `globals: { 'ts-jest': {...} }`는 ts-jest 29에서 **deprecated** → `transform` 방식으로 이전
   ```ts
   transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { paths: { '@/*': ['./*'] } } }] }
   ```
2. `testEnvironment: 'node'`인데 `testMatch`에 `.tsx`가 포함되고 `@testing-library/react`가 설치돼 있습니다. React 컴포넌트 테스트를 작성하면 실패합니다. `jest-environment-jsdom`이 **미설치** 상태입니다 → 컴포넌트 테스트 계획이 있다면 설치 후 프로젝트 분리 설정 필요
3. 커버리지 임계값 미설정 → 회귀 방지 장치 없음

---

### 🟡 M-4. 테스트 커버리지가 위험 영역을 전혀 다루지 않음

현재 테스트는 2건뿐입니다.

| 파일 | 대상 | 위험도 |
|---|---|---|
| `tests/lib/scoring.test.ts` | 점수 기반 자동승인 판정 | 중 |
| `tests/api/chat.test.ts` | 상담 챗봇 세션 | 낮음 |

**테스트가 0건인 영역**: 인증(`auth.ts`), 인가(`authz.ts`), 과제 승인(`approve`), 에이전트 게이트 전환(`registry PATCH`), 데이터 요건 생성(`projects POST`) — **1차·2차 리뷰에서 지적된 Critical 이슈가 전부 이 영역에 있습니다.**

더 중요한 점은, `scoring.test.ts`가 검증하는 규칙(G3는 자동승인 불가, 70점 이상 자동승인)이 **런타임에 두 경로로 우회 가능**하다는 것입니다.
- `POST /api/projects`에서 클라이언트가 `autoApproved: true` 직접 지정 (1차 리뷰)
- `POST /api/approve/[id]`가 `confidentialityLevel`·`scoreCard`를 확인하지 않음 (C-2)

**즉, 테스트는 통과하지만 시스템은 규칙을 지키지 않습니다.** 순수 함수 단위 테스트만으로는 이 격차를 잡을 수 없습니다.

**조치 (우선순위 순)**
1. `authz.requireRole()` 단위 테스트 — 미로그인/비활성 직원/역할 불일치 3케이스
2. `approve` API 통합 테스트 — ScoreCard 없는 과제 승인 시도 → 400 기대
3. `registry PATCH` 테스트 — GATE3→ACTIVE 전환 시 `gate2Passed`가 임의로 true가 되지 않는지 (1차 리뷰 C-4)
4. `projects POST` 테스트 — body에 `status: 'production'` 주입 시 무시되는지

---

### 🟡 M-5. 비즈니스 로직에 개인 실명 하드코딩

**파일**: `tests/lib/scoring.test.ts`

```ts
test('G3 과제는 점수 무관 항상 인표님 보고', () => { ... })
test('G1 + 67점 이하 → 인표님 보고', () => { ... })
```

테스트명뿐 아니라 `src/lib/scoring.ts`의 `reason` 문자열에도 동일 표현이 들어있을 가능성이 높습니다(테스트가 `reason`을 문자열로 검증 중). 담당자 변경 시 코드 수정이 필요해지고, 사내 문서·감사 자료에 그대로 노출됩니다.

**조치**: 역할 기반 표현으로 교체 — `'AX팀장 보고'`, `'승인권자 보고'` 등. 실제 통보 대상은 `Employee.role` 조회로 해결하세요.

---

### 🟡 M-6. 개발 의존성이 운영 번들에 포함

**파일**: `package.json`

`dependencies`에 있어야 할 이유가 없는 항목들:

```json
"@testing-library/jest-dom": "^6.9.1",
"@testing-library/react": "^16.3.2",
"@types/bcryptjs": "^2.4.6",
"@types/cytoscape": "^3.21.9",
"@types/xlsx": "^0.0.35",
```

`output: 'standalone'` 빌드에서 불필요한 용량이 늘고, 컨테이너 이미지 스캔 시 노이즈가 발생합니다. **전부 `devDependencies`로 이동** (`@types/xlsx`는 아예 삭제 — H-4 참조).

**추가 확인 필요**: `lucide-react: ^1.23.0` — 해당 패키지의 배포 버전 체계와 일치하는지 `npm view lucide-react versions`로 확인하세요. 버전이 실재하지 않으면 lockfile이 예상과 다른 버전을 고정하고 있을 수 있습니다.

---

### 🟡 M-7. 시크릿 관리

**파일**: `.env.example`

```
NEXTAUTH_SECRET=change-me-in-production
SNOWFLAKE_PASSWORD=your-snowflake-password
OPENAI_API_KEY=sk-...
KNOX_API_KEY=your-knox-api-key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

- `NEXTAUTH_SECRET`의 기본값이 그대로 배포되면 **세션 토큰 위조가 가능**합니다. 예시 파일에 생성 명령을 명시하세요: `# openssl rand -base64 32`
- 운영 환경에서 프로덕션 DB 자격증명·외부 API 키를 평문 `.env`로 관리하는 것은 금융회사 내부통제 기준에 부합하기 어렵습니다. **사내 시크릿 관리 체계(Vault, K8s Secret, 사내 KMS 등) 연동**을 아키텍처 결정 사항으로 등록하세요.
- `.gitignore`에 `.env`, `.env.local`, `*.db`(SQLite 파일)가 포함돼 있는지 확인 필요 — **v2 번들에 `.gitignore`가 없어 확인 불가**
- `NOTIFY_CHANNEL=console`이 기본값이므로, 운영 배포 시 `knox`로 전환하지 않으면 **알림이 조용히 콘솔로만 나갑니다.** 운영 환경 필수 변수 검증 로직 추가를 권장합니다

**긍정적 확인**: `# PostgreSQL 온프레미스 (WS-D)` 섹션이 있어 **PG 전환이 이미 계획돼 있음**이 확인됩니다(1차 리뷰 권고와 일치). SQLite 우회책(String enum, JSON-as-String) 정리를 이 전환 시점에 함께 진행하세요.

---

### 🟡 M-8. 에러 바운더리 부재

**파일**: `app/providers.tsx`

```tsx
export function Providers({ children }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

`error.tsx`, `not-found.tsx`, `global-error.tsx`가 번들에 없습니다. 클라이언트 렌더링 오류 발생 시 사용자에게 Next.js 기본 오류 화면이 노출됩니다. 각 라우트 세그먼트에 `error.tsx`를 추가하세요.

---

## 3. 1차 리뷰 항목 중 이번에 확정 / 정정된 사항

### ✅ 확정된 것

| 1차 리뷰 지적 | v2 확인 결과 |
|---|---|
| Prisma 클라이언트 이중화 | **사실** — `src/lib/db.ts`, `lib/prisma.ts` 별도 존재. 운영에서만 2 인스턴스 (H-3) |
| `SCHEMA_VER` 수동 캐시 무효화가 근본 원인 회피 | **사실** — `postinstall: prisma generate` 부재가 원인 (H-3) |
| `Employee.password` 필드가 사용되지 않음 | **사실** — `bcryptjs`까지 설치돼 있으나 미배선 (H-5) |
| `AuditLog` 미사용 | **사실** — 승인 API에도 기록 없음 (H-2) |
| `Project` vs `AXProject` 이중 모델 혼란 | **사실** — `/api/registry/links`는 `AXProject`, `/api/projects`는 `Project`. 같은 화면에서 두 모델 혼용 확인 |

### ⚠️ 정정 사항

**1차 리뷰에서 "DataRequest 상태값 불일치로 Gate2 경고가 오작동할 것"이라 지적했으나, 일부 정정합니다.**

`approve` API에서 `DRAFT → PENDING` 전환이 확인되어, `/api/registry` PATCH의 `status: { in: ['DRAFT','PENDING'] }` 조건은 **실제로는 정상 동작**합니다.

다만 문제의 본질은 남아있습니다 — **`schema.prisma`의 주석이 실제 구현과 다릅니다.**

```prisma
// DataRequestStatus: REQUESTED | REVIEWING | SEC_REVIEW | APPROVED | COLLECTING | REJECTED | PROVISIONED | EXPIRED | REVOKED
```
→ 실제 사용값: `DRAFT`, `PENDING` (주석에 없음)

신규 개발자가 주석을 신뢰하고 `REQUESTED`로 저장하는 코드를 작성하면 그때 경고가 조용히 실패합니다. **주석을 실제 값으로 갱신하거나, 상태 상수를 `lib/constants.ts`로 추출**해 단일 출처를 만드세요.

---

## 4. 여전히 확인 불가 — 추가 요청 파일

| 파일 | 필요 이유 | 우선순위 |
|---|---|---|
| **`middleware.ts`** | `/dashboard`, `/api/ax-projects` 무인증 노출의 실제 영향 판정. **없다면 두 건 모두 즉시 사고** | 🔴 최우선 |
| `.gitignore` | `.env`, `dev.db` 커밋 여부 확인 (M-7) | 🔴 |
| `prisma/seed.ts` | 데모 계정 5종의 실재·비밀번호 처리 방식 (H-5 조치 설계에 필요) | 🟠 |
| `src/lib/scoring.ts` | `determineApproval` 실제 구현. 승인 API와의 연결 여부 (C-2) | 🟠 |
| `app/globals.css` | 1차 리뷰의 다크테마 잔재·명암비 문제 원인 | 🟡 |
| `tsconfig.json` | `strict` 모드 여부. 코드 전반의 `as any` 남용과 관련 | 🟡 |

> `middleware.ts` 파일이 프로젝트에 **존재하지 않는다면**, 그 자체가 결론입니다. 이 경우 `/dashboard`와 `/api/ax-projects`는 현재 미인증 접근이 가능한 상태이며, 최우선 조치 대상이 됩니다.

---

## 5. 조치 체크리스트

### 5.1 즉시 (배포 전 필수)

- [ ] **`middleware.ts` 존재 여부 확인.** 없으면 인증 미들웨어 신규 작성 (`/login`, `/api/auth/*` 제외 전 경로 세션 검사)
- [ ] `/api/ax-projects`에 `requireRole()` 추가 **(C-1)**
- [ ] `/dashboard` 페이지에 `requireRole()` 추가 *(1차 리뷰)*
- [ ] `approve` API: `action` 화이트리스트 검증 **(C-3)**
- [ ] `approve` API: `project.status` 및 `scoreCard` 존재 검증 **(C-2)**
- [ ] `auth.ts`: `bcrypt.compare` 기반 실제 인증 구현 **(H-5)** *(1차 리뷰 최우선 항목)*
- [ ] `POST /api/projects`: `status`·`autoApproved`·`approvedBy`·`totalScore` 서버 전용 필드 차단 *(1차 리뷰)*
- [ ] `registry PATCH`: `gate2Passed` 자동 설정 로직 제거 *(1차 리뷰)*
- [ ] `.gitignore`에 `.env*`, `*.db` 포함 확인 **(M-7)**

### 5.2 2주 내

- [ ] `approve`·`registry/links`를 `requireRole()`로 전환 **(H-1)**
- [ ] `session.maxAge` 8시간으로 단축 **(H-1)**
- [ ] `approve` API 트랜잭션 처리 + `AuditLog` 기록 **(H-2)**
- [ ] `src/lib/db.ts` 제거, Prisma 클라이언트 일원화 + `postinstall: prisma generate` **(H-3)**
- [ ] `SCHEMA_VER` 해킹 제거 **(H-3)**
- [ ] `xlsx` 취약 버전 교체, `@types/xlsx` 삭제 **(H-4)**
- [ ] `registry/links` 에러 처리 및 `role` 검증 **(H-6)**
- [ ] zod 도입 — 전 API 입력 검증 일괄 적용 **(C-3 근본 해결)**
- [ ] `package.json`에 `test`·`typecheck` 스크립트 추가 **(M-3)**
- [ ] 개발 의존성 재분류 **(M-6)**

### 5.3 1개월 내

- [ ] 역할별 권한 매트릭스 확정 및 `authz.ts` 상수화, API·사이드바 동일 참조 **(M-1)**
- [ ] 사이드바 메뉴 단일 정의 구조로 리팩터링 **(M-2)**
- [ ] jest 설정 현행화(`transform` 이전, jsdom 분리) + 커버리지 임계값 **(M-3)**
- [ ] 인증·인가·승인·게이트 전환 테스트 작성 **(M-4)**
- [ ] `scoring.ts` 실명 하드코딩 제거 **(M-5)**
- [ ] 시크릿 관리 체계 연동 방안 결정 **(M-7)**
- [ ] `error.tsx` 등 에러 바운더리 추가 **(M-8)**
- [ ] `schema.prisma` 상태값 주석 현행화 + `lib/constants.ts` 단일 출처화 **(3장 정정 사항)**
- [ ] PostgreSQL 전환 (WS-D) — enum·인덱스·cascade 정의 동시 진행 *(1차 리뷰)*
- [ ] `Project`/`AXProject`, `Agent`/`AgentRegistry` 통합 설계 결정 *(1차 리뷰)*

---

## 6. 종합 의견

v2 확인 결과, 이 시스템의 문제는 **개별 버그의 집합이 아니라 일관성의 부재**입니다.

- 인증 방식이 3가지 (`requireRole` / 인라인 세션 / 없음)
- 역할 정의가 4곳에서 상이 (스키마 주석 / authz / API / 사이드바)
- Prisma 클라이언트가 2개, 환경별 동작 상이
- "프로젝트" 개념이 2개 모델
- 상태값 어휘가 문서와 구현에서 불일치

각 요소는 개별적으로 잘 만들어져 있습니다. `authz.ts`의 `isActive` 재확인, 사이드바의 최장 prefix 매칭, `.env.example`의 PG 전환 계획, 승인 시 DataRequest 자동 전환 등은 **설계 수준이 높습니다.** 문제는 이 좋은 설계들이 서로 연결되지 않고, 일부 경로만 그것을 통과한다는 점입니다.

따라서 개별 버그 수정보다 **단일 출처(single source of truth) 확립**이 더 효과적인 접근입니다.

1. 인증/인가 → `lib/authz.ts` 단일 진입점, 예외 없음
2. 입력 검증 → zod 스키마, API별 필수
3. 상태값 → `lib/constants.ts`
4. DB 접근 → `lib/prisma.ts` 단일 클라이언트
5. 권한 매트릭스 → 문서 1장, 코드가 이를 참조

이 5가지가 정리되면 현재 발견된 이슈의 대부분과 **앞으로 생길 같은 유형의 이슈**가 함께 차단됩니다.

파일럿 단계인 지금이 이 정리를 하기에 가장 비용이 낮은 시점입니다.

---

*본 문서는 제공된 코드 스냅샷(`ax-hub-code-review.md`, `ax-hub-code-review-v2.md`) 기준으로 작성되었습니다. `middleware.ts` 등 미제공 파일에 관련 방어 로직이 존재할 경우 일부 지적의 심각도가 조정될 수 있습니다.*
