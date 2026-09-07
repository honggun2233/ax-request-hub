import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    id: string
    employeeId: string
    role: string
    currentLevel: string
    department: string
  }
  interface Session {
    user: {
      id: string
      employeeId: string
      email: string
      name: string
      role: string
      currentLevel: string
      department: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    employeeId: string
    role: string
    currentLevel: string
    department: string
  }
}
