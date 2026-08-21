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
