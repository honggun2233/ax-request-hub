# AX Hub P0 인증 코드리뷰 v2
> 작성일: 2026-08-21 | 커밋: `2ee7b2f` (master)
> v1 리뷰 이슈 반영 완료본 — 이전 이슈 대비 변경 내역 포함

---

## v1 → v2 반영 요약

| 이슈 | 심각도 | 상태 |
|------|-------|------|
| matcher 두 패턴이 OR로 동작 → `/api/auth/callback` 로그인 불가 | 🔴 Critical | ✅ 수정 완료 |
| `withAuth` 사용 → C트랙 서비스 토큰 API가 HTML 리다이렉트 받음 | 🔴 Critical | ✅ 수정 완료 |
| `TEMP_AUTH_PASSWORD` 평문 비교 → 타이밍 어택 취약 | 🟠 High | ✅ 수정 완료 |
| `toSessionUser()`에 `employeeId` 누락 — SessionUser 타입 불일치 | 🟡 Medium | ✅ 수정 완료 |
| 로그인 API Rate Limiting 부재 | 🟡 Medium | ⏳ 후속 작업(C트랙 추진 시 병행) |

---

## 1. middleware.ts (전면 재작성)

### 변경 포인트
- **Before**: `withAuth` + 두 개의 matcher 패턴(Critical 버그)
- **After**: 커스텀 `middleware()` + 단일 matcher 패턴

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

/**
 * 단일 matcher로 인증 게이트를 처리.
 * - /api/auth/**  : NextAuth 자체 엔드포인트 → matcher 제외로 통과
 * - /api/**       : 서비스 토큰 OR 세션 JWT 필요
 * - 앱 페이지     : 세션 JWT 없으면 /login 리다이렉트
 * - C트랙 에이전트: x-service-token 헤더로 인증
 */
export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith("/api")

  // C트랙 서비스 토큰 — API 한정 (에이전트 Push 등 서버-서버 호출)
  if (isApi) {
    const serviceToken = req.headers.get("x-service-token")
    if (serviceToken) {
      const validToken = process.env.SERVICE_API_TOKEN
      if (validToken && serviceToken === validToken) {
        return NextResponse.next()
      }
      // 토큰이 있지만 유효하지 않음 → JSON 401 (리다이렉트 금지)
      return NextResponse.json(
        { error: "유효하지 않은 서비스 토큰입니다" },
        { status: 401 }
      )
    }
  }

  // 세션 JWT 검증
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    // API 미인증 → JSON 401 / 페이지 미인증 → /login 리다이렉트
    return isApi
      ? NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // /api/auth/**, /login, _next 정적 파일, favicon.ico 제외 — 나머지 전체 보호
    "/((?!api/auth|login|_next/static|_next/image|favicon\\.ico).*)",
  ],
}
```

### 검토 포인트 (리뷰어 확인 요청)
- [ ] `SERVICE_API_TOKEN` 환경변수 미설정 시 서비스 토큰 분기가 건너뜀 → 설정되지 않은 상태에서 임의 토큰으로 접근 가능한지 검토
  - 현재: `validToken`이 `undefined`면 조건 `validToken && ...` 실패 → 서비스 토큰 경로로 진입하지 않고 세션 JWT로 폴백 (의도된 동작이지만 명시적 주석 필요 여부 검토)
- [ ] `getToken()` 호출 오버헤드: 매 요청마다 JWT 파싱 — `NEXTAUTH_SECRET` 설정 누락 시 silent 실패 가능 여부 확인

---

## 2. lib/auth.ts (일부 수정)

### 변경 포인트
1. `timingSafeEqual` import + `safeCompare()` 헬퍼 추가
2. `TEMP_AUTH_PASSWORD` 비교: 평문 `!==` → `!safeCompare()`
3. `toSessionUser()`에 `employeeId` 추가
4. JWT/세션 콜백에 `employeeId` 전파

```typescript
// lib/auth.ts
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import type { Employee } from "@prisma/client"

/** 타이밍 어택 방지 — TEMP_AUTH_PASSWORD 평문 비교에 사용 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function toSessionUser(emp: Employee) {
  return {
    id: emp.id,
    employeeId: emp.employeeId,  // ← 추가 (authz.ts SessionUser 타입 정합)
    email: emp.email,
    name: emp.name,
    role: emp.role,
    currentLevel: emp.currentLevel,
    department: emp.department,
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "사내 계정",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim()
        const password = credentials?.password ?? ""
        if (!email) return null

        // ── 개발환경 우회 ─────────────────────────────────────────
        // 안전장치1: NODE_ENV가 'development'일 때만
        // 안전장치2: DEV_BYPASS_USER도 명시적으로 설정돼 있어야 함
        // 프로덕션 차단(안전장치3)은 instrumentation.ts에서 부팅 시 처리
        if (process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_USER) {
          console.warn(
            `⚠️  DEV BYPASS ACTIVE — logging in as ${process.env.DEV_BYPASS_USER}. 프로덕션 배포 전 반드시 제거 확인.`
          )
          const emp = await prisma.employee.findUnique({
            where: { email: process.env.DEV_BYPASS_USER },
          })
          return emp && emp.isActive ? toSessionUser(emp) : null
        }
        // ──────────────────────────────────────────────────────────

        const emp = await prisma.employee.findUnique({ where: { email } })
        if (!emp || !emp.isActive) return null

        // 비밀번호 검증 (3단계 fallback)
        const tempPassword = process.env.TEMP_AUTH_PASSWORD
        if (tempPassword) {
          // 과도기: 전직원 동일 임시 비밀번호 (SSO/LDAP 연동 전)
          if (!safeCompare(password, tempPassword)) return null  // ← timingSafeEqual 적용
        } else if (emp.password) {
          // 개인 bcrypt 해시 검증
          const valid = await bcrypt.compare(password, emp.password)
          if (!valid) return null
        } else {
          // 비밀번호 미설정 계정 — 로그인 거부 (빈 문자열 통과 방지)
          return null
        }

        return toSessionUser(emp)
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.employeeId = (user as any).employeeId  // ← 추가
        token.role = (user as any).role
        token.currentLevel = (user as any).currentLevel
        token.department = (user as any).department
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).employeeId = token.employeeId  // ← 추가
        ;(session.user as any).role = token.role
        ;(session.user as any).currentLevel = token.currentLevel
        ;(session.user as any).department = token.department
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
}
```

### 검토 포인트 (리뷰어 확인 요청)
- [ ] `safeCompare()`에서 길이 불일치 시 `false` 반환 — 길이 자체가 타이밍 정보를 노출하지 않는지 검토
  - 현재: 길이 다르면 즉시 반환(O(1)) — 길이가 비밀이 아닌 공개값이므로 허용 가능하다고 판단
- [ ] `TEMP_AUTH_PASSWORD`는 SSO 전 임시용 — 사용 시 비밀번호 복잡도 정책 필요 여부 (별도 문서화 검토)
- [ ] `toSessionUser()`가 반환하는 `employeeId`가 Prisma `Employee.employeeId` 컬럼과 1:1 매핑되는지 스키마 재확인 권장

---

## 3. instrumentation.ts (변경 없음)

v1에서 구현된 상태로 유지. 참고용으로 전체 코드 포함.

```typescript
// instrumentation.ts
// Next.js 서버 초기화 훅 — 앱 실행 전 안전장치 검사
export async function register() {
  // 안전장치3: 프로덕션에서 DEV_BYPASS_USER가 살아있으면 서버 시작 자체를 차단
  // authorize() 안에 두면 서버가 뜨고 나서 첫 로그인 시 에러가 나지만,
  // 여기 두면 배포 직후 바로 드러남 — CI/CD 파이프라인에서 조기 감지 가능
  if (process.env.NODE_ENV === "production" && process.env.DEV_BYPASS_USER) {
    throw new Error(
      "DEV_BYPASS_USER가 프로덕션 환경에 설정되어 있습니다. 즉시 제거하세요."
    )
  }
}
```

> ✅ Next.js 16.2.9 (= Next 15+)에서 `experimental.instrumentationHook` 설정 불필요 — 내장 지원

---

## 환경변수 추가 필요

```env
# C트랙 서비스 토큰 (에이전트 Push 등 서버-서버 API 인증)
# middleware.ts에서 x-service-token 헤더와 비교
SERVICE_API_TOKEN="<강력한-랜덤-토큰-32자-이상>"
```

> ⚠️ 미설정 시 서비스 토큰 경로는 비활성화되고 세션 JWT 검증으로 폴백됨 — C트랙 구현 전까지는 무방

---

## 남은 이슈 (v3에서 처리 예정)

### 🟡 Medium — Rate Limiting
로그인 엔드포인트(`/api/auth/callback/credentials`) 브루트포스 방어 부재.
- 구현 방안: `next-rate-limit` 또는 미들웨어에서 IP별 카운터(Redis/메모리)
- 선행 조건: C트랙 Redis 인프라 확정 후 함께 적용 예정

### 향후 검토
- SSO/LDAP 연동 완료 후 `TEMP_AUTH_PASSWORD` 경로 전체 제거
- `Service API Token` → JWT 서명 방식으로 업그레이드 (현재 Bearer 토큰은 탈취 시 영구 유효)
