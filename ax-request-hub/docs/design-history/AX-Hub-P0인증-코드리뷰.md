# AX Hub P0 인증 통합 — 코드 리뷰

**커밋**: `843fd88`  
**작성일**: 2026-08-21  
**변경 파일**: 3개 (lib/auth.ts 수정, instrumentation.ts 신설, middleware.ts 신설)

---

## 파일 1: `lib/auth.ts` (수정)

```ts
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import type { Employee } from "@prisma/client"

function toSessionUser(emp: Employee) {
  return {
    id: emp.id,
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
          if (password !== tempPassword) return null
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
        token.role = (user as any).role
        token.currentLevel = (user as any).currentLevel
        token.department = (user as any).department
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
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

---

## 파일 2: `instrumentation.ts` (신설)

```ts
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

---

## 파일 3: `middleware.ts` (신설)

```ts
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

// 1차 방어선: 모든 /api/* 요청에 인증 게이트
// 개별 라우트의 requireRole()은 2차(defense in depth)로 그대로 유지
export default withAuth(
  function middleware() {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
)

export const config = {
  matcher: [
    // /api/auth/** (NextAuth 자체 엔드포인트)만 제외하고 나머지 API 전체 보호
    "/api/((?!auth/).*)",
    // 앱 페이지 경로 — /login은 제외
    "/((?!login|_next/static|_next/image|favicon.ico).*)",
  ],
}
```

---

## 리뷰 포인트 체크리스트

### auth.ts
- [ ] `toSessionUser(emp)` — `authz.ts`의 `SessionUser` 타입과 반환 구조 일치 여부 확인 (`employeeId` 필드 누락 여부)
- [ ] `(user as any).role` — jwt 콜백의 `as any` 캐스팅이 타입 확장(NextAuth augmentation)으로 대체 가능한지
- [ ] DEV_BYPASS_USER 우회 시 입력받은 `credentials`는 아예 무시됨 — 의도된 동작인지 확인
- [ ] `TEMP_AUTH_PASSWORD` 평문 비교 (`password !== tempPassword`) — 타이밍 어택 취약점 (상수시간 비교 함수 필요 여부)
- [ ] `password === ""` 일 때 `bcrypt.compare("", "")` 결과 — `else` 분기에서 거부하므로 안전

### instrumentation.ts
- [ ] Next.js 13+ 프로젝트에서 `instrumentation.ts`가 실제로 로드되는지 — `next.config.ts`에 `experimental.instrumentationHook: true` 필요 여부 (Next.js 15 기준 자동 지원)
- [ ] Edge 런타임에서도 실행되는지 — `process.env.NODE_ENV` 접근 가능 여부

### middleware.ts
- [ ] matcher 패턴 — `/((?!login|_next/static|_next/image|favicon.ico).*)` 에서 공개 페이지가 더 있으면 추가 필요
- [ ] `basePath` 설정 없음 확인 — next.config.ts에 basePath 없으므로 패턴 그대로 유효
- [ ] `/api/auth/` 이외에 공개 API가 생기면 matcher에서 제외해야 함

---

## 전제 조건 (.env.local)

```env
NEXTAUTH_SECRET="skHxMWjLSDpYjPHqcr1djm+AtfwjBlmeBx8fDqaFWF8="
NEXTAUTH_URL="http://localhost:3005"

# 개발환경 우회 (NODE_ENV=development 일 때만 작동)
DEV_BYPASS_USER="admin@samsungam.com"

# 임시 운영 비밀번호 (SSO/LDAP 연동 전 과도기)
# TEMP_AUTH_PASSWORD="your-temp-password-here"
```

---

## 알려진 미해결 사항

| 항목 | 내용 |
|---|---|
| `as any` 캐스팅 | NextAuth 타입 augmentation(`next-auth.d.ts`)으로 교체하면 타입 안전해짐 |
| TEMP_AUTH_PASSWORD 평문 비교 | 내부망 한정이면 허용 가능, 외부 노출 시 `timingSafeEqual` 검토 |
| SSO/LDAP 연동 | 실제 사내 LDAP 주소 확보 후 `else` 분기 대체 |
| Next.js 15 instrumentation | `experimental.instrumentationHook` 옵션 필요 여부 — 로컬 테스트로 확인 필요 |
