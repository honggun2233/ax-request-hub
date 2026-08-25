import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 공개 경로 통과
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // /api/internal/* — ServiceToken Bearer 인증 전용 경로
  // 실제 토큰 검증은 각 route 핸들러에서 verifyServiceToken()으로 처리.
  // middleware에서 Prisma를 쓸 수 없으므로(Edge Runtime) 토큰 존재 여부만 체크.
  if (pathname.startsWith('/api/internal/')) {
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Service token required. Use Authorization: Bearer <token>' },
        { status: 401 },
      )
    }
    // Bearer 토큰이 있으면 route 핸들러로 넘김 (실제 검증은 route에서)
    return NextResponse.next()
  }

  // 그 외 모든 경로 — NextAuth 세션 체크
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    // API 경로: 401 JSON (HTML 리다이렉트 금지)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // 페이지 경로: 로그인 리다이렉트
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Next.js 내부 경로 제외
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
