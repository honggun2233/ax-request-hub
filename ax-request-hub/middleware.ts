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
