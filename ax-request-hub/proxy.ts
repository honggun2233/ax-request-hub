/**
 * proxy.ts — Next.js 16 인증·인가 게이트 (middleware.ts 대체)
 *
 * 레이어 구조:
 *  1. NextAuth 엔드포인트 + 공개 페이지 → 무조건 통과
 *  2. API 경로 — C트랙 서비스 토큰(x-service-token) OR 세션 JWT
 *  3. 앱 페이지 — 세션 JWT + 역할별 접근 제어
 */
import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const ROLE_GUARDS: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin",     roles: ["AX_TEAM", "C_LEVEL"] },
  { prefix: "/executive", roles: ["AX_TEAM", "C_LEVEL", "EXECUTIVE"] },
  { prefix: "/dp",        roles: ["AX_TEAM", "DATA_PLATFORM"] },
  { prefix: "/council",   roles: ["AX_TEAM", "C_LEVEL"] },
]

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith("/api")

  // 1. NextAuth 자체 엔드포인트 + 공개 페이지 → 통과
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/"
  ) {
    return NextResponse.next()
  }

  // 2. C트랙 서비스 토큰 — API 전용 (에이전트 Push 등 서버-서버 호출)
  if (isApi) {
    const serviceToken = req.headers.get("x-service-token")
    if (serviceToken) {
      const validToken = process.env.SERVICE_API_TOKEN
      if (validToken && serviceToken === validToken) return NextResponse.next()
      return NextResponse.json(
        { error: "유효하지 않은 서비스 토큰입니다" },
        { status: 401 }
      )
    }
  }

  // 3. 세션 JWT 검증
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return isApi
      ? NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url))
  }

  // 4. 역할별 페이지 접근 제어
  const role = (token as any).role as string | undefined
  for (const guard of ROLE_GUARDS) {
    if (pathname.startsWith(guard.prefix)) {
      if (!role || !guard.roles.includes(role)) {
        return NextResponse.redirect(new URL("/me", req.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // /api/auth/**, /login, /, _next 정적, favicon 제외 — 나머지 전체
    "/((?!api/auth|login|_next/static|_next/image|favicon\\.ico)(?!$).*)",
    "/",  // 루트는 통과시키기 위해 별도 포함 (위 패턴이 빈 path를 제외)
  ],
}
