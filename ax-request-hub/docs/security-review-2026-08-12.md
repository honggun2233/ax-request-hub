# AX Request Hub — 보안 취약점 점검 리포트

**점검일**: 2026-08-12  
**점검 기준**: OWASP Top 10 (2021)  
**점검 범위**: API 라우트 및 인증/인가 레이어

---

## 요약

| 심각도 | 건수 |
|--------|------|
| CRITICAL | 2 |
| HIGH | 4 |
| MEDIUM | 4 |
| LOW | 2 |

---

## 취약점 목록

---

### [CRITICAL-1] 인증 우회 — 비밀번호 검증 없이 자동 로그인

**파일**: `lib/auth.ts` (라인 13–28)  
**OWASP 분류**: A07:2021 – Identification and Authentication Failures

**설명**  
`CredentialsProvider`의 `authorize` 함수가 입력된 이메일/비밀번호를 전혀 검증하지 않고, DB에서 `role = "AX_TEAM"`인 첫 번째 직원을 무조건 반환한다. 즉, 임의의 이메일과 비밀번호로 로그인 요청을 보내면 AX_TEAM 권한의 세션이 발급된다.

```typescript
// 현재 코드 (lib/auth.ts:14-18)
// TODO: SSO/LDAP 연동 전 임시 — 입력값 무관하게 기본 관리자로 자동 로그인
const employee = await db.employee.findFirst({
  where: { role: "AX_TEAM", isActive: true },
  orderBy: { createdAt: "asc" },
})
```

**심각도**: CRITICAL  
**권고 수정 방법**  
- SSO/LDAP 연동 전이라도 최소한 이메일+평문 비교 또는 bcrypt 해시 비교를 추가한다.
- 프로덕션 배포 전에는 반드시 실제 인증 로직으로 교체해야 한다.
- 임시 개발 환경이라면 `NODE_ENV !== 'production'` 가드로 프로덕션 노출을 차단한다.

```typescript
// 권고 예시
async authorize(credentials) {
  if (!credentials?.email || !credentials?.password) return null
  const employee = await db.employee.findUnique({
    where: { email: credentials.email, isActive: true },
  })
  if (!employee) return null
  const isValid = await bcrypt.compare(credentials.password, employee.passwordHash)
  if (!isValid) return null
  return { id: employee.id, email: employee.email, role: employee.role, ... }
}
```

---

### [CRITICAL-2] 인증 없는 공개 API — 전체 그래프 데이터 노출

**파일**: `app/api/graph/route.ts` (라인 4–68)  
**OWASP 분류**: A01:2021 – Broken Access Control

**설명**  
`GET /api/graph` 핸들러에 세션 확인 코드가 전혀 없다. 인증되지 않은 누구든 해당 엔드포인트를 호출하면 전체 프로젝트 목록, 에이전트 목록, 데이터 자산 목록(분류 등급 포함), 관계 그래프를 조회할 수 있다. `mode=full` 파라미터로 모든 노드와 엣지를 한 번에 추출 가능하다.

```typescript
// 현재 코드 (app/api/graph/route.ts:4)
export async function GET(req: Request) {
  // 세션 확인 없음 — 인증 없이 접근 가능
  const { searchParams } = new URL(req.url)
  ...
  prisma.project.findMany(...)  // 전체 과제 노출
  prisma.dataAsset.findMany(...)  // 기밀 데이터 자산 분류등급 포함 노출
```

**심각도**: CRITICAL  
**권고 수정 방법**  
```typescript
import { requireRole } from '@/lib/authz'

export async function GET(req: Request) {
  const auth = await requireRole()
  if ('error' in auth) return auth.error
  // 이하 기존 로직
}
```

---

### [HIGH-1] Mass Assignment — 서버 전용 필드를 클라이언트가 임의 설정 가능

**파일**: `app/api/projects/route.ts` (라인 64–72)  
**OWASP 분류**: A03:2021 – Injection / A01:2021 – Broken Access Control

**설명**  
POST 핸들러에서 `body`를 `{ dataRequirements, noDataRequired, ...projectData }` 로 분해한 뒤 `projectData` 전체를 `prisma.project.create({ data: { ...projectData, ... } })`에 전달한다. Prisma 스키마 기준으로 `status`, `autoApproved`, `totalScore`, `approvedBy`, `decisionNote`, `techStandardsPassed`, `gate*` 등 서버 전용 필드가 클라이언트에서 주입될 수 있다.

예를 들어 클라이언트가 `{ "status": "pilot", "autoApproved": true, "totalScore": 100 }`을 포함하면 즉시 승인 상태로 과제가 생성된다.

```typescript
// 현재 코드 (app/api/projects/route.ts:64-72)
const project = await prisma.project.create({
  data: {
    ...projectData,  // 클라이언트 입력 전체 전달 — status, autoApproved 등 포함 가능
    noDataRequired: !!noDataRequired,
    source: projectData.source ?? 'ax_discovery',
  },
})
```

**심각도**: HIGH  
**권고 수정 방법**  
허용 필드를 명시적으로 화이트리스트로 나열한다.

```typescript
const project = await prisma.project.create({
  data: {
    title: projectData.title,
    department: projectData.department,
    requesterName: projectData.requesterName,
    requesterEmail: projectData.requesterEmail,
    description: projectData.description,
    asIs: projectData.asIs,
    expectedBenefit: projectData.expectedBenefit,
    confidentialityLevel: projectData.confidentialityLevel ?? 'G2',
    championName: projectData.championName ?? null,
    estimatedUsers: projectData.estimatedUsers ?? 0,
    expectedBenefitValue: projectData.expectedBenefitValue ?? null,
    expectedBenefitUnit: projectData.expectedBenefitUnit ?? null,
    isEssentialBusiness: projectData.isEssentialBusiness ?? false,
    noDataRequired: !!noDataRequired,
    source: 'ax_discovery',  // 클라이언트 source 입력 무시
    // status, autoApproved, totalScore, approvedBy 등은 서버에서만 설정
  },
})
```

---

### [HIGH-2] Mass Assignment — AgentRegistry 전체 body 직접 전달

**파일**: `app/api/registry/route.ts` (라인 52)  
**OWASP 분류**: A03:2021 – Injection

**설명**  
POST 핸들러가 요청 body를 파싱한 `data`를 그대로 `prisma.agentRegistry.create({ data })`에 전달한다. 클라이언트가 `gate1Passed: true`, `gate2Passed: true`, `gate3Passed: true`, `lifecycleStage: "ACTIVE"` 등 게이트 통과 여부와 운영 단계를 임의 설정할 수 있다.

```typescript
// 현재 코드 (app/api/registry/route.ts:52)
const agent = await prisma.agentRegistry.create({ data })  // data = 전체 req.json()
```

**심각도**: HIGH  
**권고 수정 방법**  
프로젝트 라우트와 동일하게 허용 필드만 명시적으로 추출한다.

```typescript
const { agentName, agentType, projectId, description, operatorEmail } = data
const agent = await prisma.agentRegistry.create({
  data: {
    agentName, agentType, projectId, description, operatorEmail,
    // gate*, lifecycleStage, operatorTrustScore 등은 PATCH(관리자)에서만 설정
    lifecycleStage: 'DEVELOPING',
  },
})
```

---

### [HIGH-3] JWT 토큰 역할(role) 신뢰 — DB 재확인 없이 권한 결정

**파일**: `app/api/approve/[id]/route.ts` (라인 8–10), `app/api/admin/tools/[id]/route.ts` (라인 11–13), `app/api/admin/agents/route.ts` (라인 7–9, 23–25)  
**OWASP 분류**: A07:2021 – Identification and Authentication Failures

**설명**  
위 세 파일은 `getServerSession(authOptions)`에서 반환된 `session.user.role`을 직접 신뢰하여 권한을 판단한다. JWT 토큰은 발급 후 만료 전까지 변경되지 않으므로, 직원의 역할이 AX_TEAM → EMPLOYEE로 강등된 후에도 기존 JWT 세션이 유효한 동안 계속 관리자 API를 호출할 수 있다.

반면 `lib/authz.ts`의 `requireRole()`은 매번 DB에서 역할을 재확인한다 (라인 19–24).

**심각도**: HIGH  
**권고 수정 방법**  
`session.user.role` 직접 체크 대신 `requireRole('AX_TEAM')` 또는 `requireRole('AX_TEAM', 'C_LEVEL')`을 사용하거나, 별도 DB 재확인 로직을 추가한다.

```typescript
// 권고: approve/[id]/route.ts
import { requireRole } from '@/lib/authz'

export async function POST(req, { params }) {
  const auth = await requireRole('AX_TEAM', 'C_LEVEL')
  if ('error' in auth) return auth.error
  // ...
}
```

---

### [HIGH-4] 에러 메시지에 DB/내부 정보 노출

**파일**: `app/api/projects/route.ts` (라인 106 → 수정 후 라인 113), `app/api/admin/agents/route.ts` (라인 17, 56), `app/api/registry/route.ts` (라인 25)  
**OWASP 분류**: A05:2021 – Security Misconfiguration

**설명**  
catch 블록에서 `e.message` 또는 `err?.message`를 그대로 클라이언트에 반환한다. Prisma 오류 메시지에는 테이블명, 컬럼명, 제약 조건명 등 DB 스키마 정보가 포함될 수 있다. 공격자가 의도적으로 잘못된 데이터를 전송해 스키마를 역추적하는 데 활용할 수 있다.

```typescript
// 현재 코드 (app/api/projects/route.ts)
return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })

// 현재 코드 (app/api/admin/agents/route.ts:17)
return NextResponse.json({ error: err?.message ?? 'unknown' }, { status: 500 })
```

**심각도**: HIGH  
**권고 수정 방법**  
서버에서는 상세 오류를 로깅하고 클라이언트에는 일반화된 메시지만 반환한다.

```typescript
} catch (e: any) {
  console.error('[projects POST]', e)  // 서버 로그에는 상세 오류
  return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
}
```

---

### [MEDIUM-1] Rate Limiting 부재 — 반복 신청 및 브루트포스 방지 없음

**파일**: 전체 API 라우트  
**OWASP 분류**: A07:2021 – Identification and Authentication Failures

**설명**  
로그인 엔드포인트(`/api/auth/callback/credentials`)와 과제 신청(`POST /api/projects`), 이의신청(`POST /api/appeals`) 등 민감한 엔드포인트에 요청 빈도 제한이 없다. 동일 IP/계정에서 반복 요청이 가능하다.

`tools/request` POST는 중복 신청 방지 로직이 있으나 (라인 39–48), 이는 애플리케이션 레벨 중복 방지이며 요청 자체의 빈도 제한은 아니다.

**심각도**: MEDIUM  
**권고 수정 방법**  
- Next.js 미들웨어 레벨에서 IP 기반 Rate Limiting 적용 (예: `@upstash/ratelimit` + Redis)
- 로그인 시 이메일 기준 연속 실패 횟수 추적 및 잠금 처리

---

### [MEDIUM-2] CSRF 보호 범위 불완전

**파일**: `app/api/approve/[id]/route.ts`, `app/api/projects/route.ts` 등 상태 변경 API  
**OWASP 분류**: A01:2021 – Broken Access Control

**설명**  
NextAuth는 자체 라우트(`/api/auth/*`)에 CSRF 토큰을 적용하지만, 커스텀 API 라우트는 쿠키 기반 세션을 사용하면서 별도 CSRF 방어가 없다. 공격자가 악성 사이트에서 피해자 브라우저를 통해 `/api/approve/{id}` POST를 전송하는 CSRF 공격이 가능하다.

단, `Content-Type: application/json` 요청은 preflight를 유발하므로 CORS 설정이 적절하다면 위험도는 낮아진다. 그러나 `SameSite` 쿠키 속성이 명시되지 않은 경우 브라우저 기본값에 의존한다.

**심각도**: MEDIUM  
**권고 수정 방법**  
- NextAuth 세션 쿠키에 `SameSite=Strict` 또는 `SameSite=Lax` 명시 (`authOptions.cookies` 설정)
- 중요 상태 변경 API에 `Origin` 헤더 검증 미들웨어 추가

---

### [MEDIUM-3] 입력값 길이/범위 제한 부재

**파일**: `app/api/projects/route.ts` (POST), `app/api/registry/route.ts` (POST)  
**OWASP 분류**: A03:2021 – Injection

**설명**  
필수 필드 존재 여부는 검증하지만 문자열 최대 길이, 숫자 범위 제한이 없다. 수백만 자 문자열을 `description` 또는 `asIs`에 전송하여 DB 부하를 유발할 수 있다. `estimatedUsers`에 음수나 비정상적으로 큰 값이 들어올 수 있다.

**심각도**: MEDIUM  
**권고 수정 방법**  
Zod 등 스키마 검증 라이브러리를 사용하여 각 필드의 타입, 길이, 범위를 선언적으로 검증한다.

```typescript
import { z } from 'zod'

const ProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  asIs: z.string().min(1).max(3000),
  expectedBenefit: z.string().min(1).max(3000),
  estimatedUsers: z.number().int().min(0).max(100000).optional(),
  // ...
})
```

---

### [MEDIUM-4] 권한 검증 방식 불일치 (authz 혼용)

**파일**: `app/api/approve/[id]/route.ts`, `app/api/admin/agents/route.ts`, `app/api/admin/tools/[id]/route.ts`  
**OWASP 분류**: A01:2021 – Broken Access Control

**설명**  
일부 라우트는 `requireRole()` (DB 재확인, `lib/authz.ts`), 다른 라우트는 `getServerSession()` 직접 호출 후 JWT 토큰 역할 확인 방식을 사용한다. 권한 검증 방식이 통일되지 않아 유지보수 중 보안 구멍이 발생하기 쉽다.

**심각도**: MEDIUM  
**권고 수정 방법**  
모든 보호 라우트에서 `requireRole()` 헬퍼를 일관되게 사용한다. `getServerSession()` 직접 호출 패턴은 제거한다.

---

### [LOW-1] SQL Injection — Prisma ORM 파라미터화로 방어됨 (잠재 위험 경로 존재)

**파일**: 전체 API 라우트  
**OWASP 분류**: A03:2021 – Injection

**설명**  
Prisma ORM을 사용하므로 일반적인 SQL Injection은 방어된다. 다만 `app/api/graph/route.ts`의 `exploreNode` 함수에서 `nodeId.split('-')` 파싱 후 `id` 값을 직접 Prisma 조회 파라미터로 사용하는 패턴은 Prisma가 파라미터화 처리하므로 안전하다.

`prisma.$queryRaw` 또는 `$executeRaw` 사용 시 반드시 태그드 템플릿 리터럴 문법을 사용해야 한다.

**심각도**: LOW  
**권고**: 현재 Raw Query 미사용으로 안전. 향후 Raw Query 도입 시 `Prisma.sql` 태그 사용 필수.

---

### [LOW-2] 민감 데이터 콘솔 로그 노출

**파일**: `app/api/admin/agents/route.ts` (라인 16, 56)  
**OWASP 분류**: A09:2021 – Security Logging and Monitoring Failures

**설명**  
`console.error('[admin/agents GET]', err)` 형태로 에러 전체를 로깅한다. 에러 객체에 쿼리 파라미터, 사용자 이메일 등이 포함될 수 있으며, 로그 집계 시스템에서 민감 데이터가 평문으로 저장될 수 있다.

**심각도**: LOW  
**권고**: 구조화된 로거(예: `pino`)를 사용하고 민감 필드를 마스킹한다.

---

## 우선순위별 조치 권고

| 우선순위 | 항목 | 예상 공수 |
|----------|------|-----------|
| 즉시 | CRITICAL-1: auth.ts 인증 로직 구현 | 2~4h |
| 즉시 | CRITICAL-2: graph/route.ts 인증 추가 | 30min |
| 단기 | HIGH-1,2: Mass Assignment 화이트리스트 | 2h |
| 단기 | HIGH-3: requireRole() 일관 적용 | 1h |
| 단기 | HIGH-4: 에러 메시지 일반화 | 1h |
| 중기 | MEDIUM-1: Rate Limiting 미들웨어 | 4h |
| 중기 | MEDIUM-3: Zod 입력 검증 | 4~8h |
| 장기 | MEDIUM-2: CSRF 쿠키 정책 강화 | 2h |

---

*점검자: Claude Code (claude-sonnet-4-6) / 2026-08-12*
