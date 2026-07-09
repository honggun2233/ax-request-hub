import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "@/src/lib/db"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "사내 계정",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null
        const employee = await db.employee.findUnique({
          where: { email: credentials.email, isActive: true },
        })
        if (!employee) return null
        return {
          id: employee.id,
          email: employee.email,
          name: employee.name,
          role: employee.role,
          currentLevel: employee.currentLevel,
          department: employee.department,
        }
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
  secret: process.env.NEXTAUTH_SECRET || "ai-hub-dev-secret-change-in-prod",
}
