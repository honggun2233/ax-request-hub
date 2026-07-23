import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    if (pathname.startsWith("/admin")) {
      if (!token || !["AX_TEAM", "C_LEVEL"].includes((token as any).role)) {
        return NextResponse.redirect(new URL("/me", req.url))
      }
    }
    if (pathname.startsWith("/executive")) {
      if (!token || !["AX_TEAM", "C_LEVEL", "EXECUTIVE"].includes((token as any).role)) {
        return NextResponse.redirect(new URL("/me", req.url))
      }
    }
    if (pathname.startsWith("/dp")) {
      if (!token || !["AX_TEAM", "DATA_PLATFORM"].includes((token as any).role)) {
        return NextResponse.redirect(new URL("/me", req.url))
      }
    }
    if (pathname.startsWith("/council")) {
      if (!token || !["AX_TEAM", "C_LEVEL"].includes((token as any).role)) {
        return NextResponse.redirect(new URL("/me", req.url))
      }
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname
        if (
          pathname === "/login" ||
          pathname === "/" ||
          pathname.startsWith("/api/auth")
        )
          return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ["/me/:path*", "/admin/:path*", "/submit/:path*", "/executive/:path*", "/dp/:path*", "/council/:path*"],
}
