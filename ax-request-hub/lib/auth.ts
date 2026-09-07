import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import type { Employee } from "@prisma/client"

function toSessionUser(emp: Employee) {
  return {
    id: emp.id,
    employeeId: emp.employeeId,
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

        if (!emp.password) return null
        const valid = await bcrypt.compare(password, emp.password)
        if (!valid) return null

        return toSessionUser(emp)
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.employeeId = user.employeeId
        token.role = user.role
        token.currentLevel = user.currentLevel
        token.department = user.department
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.employeeId = token.employeeId
        session.user.role = token.role
        session.user.currentLevel = token.currentLevel
        session.user.department = token.department
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
