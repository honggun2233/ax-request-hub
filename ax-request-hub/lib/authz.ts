// 공통 권한 헬퍼 — 세션 이메일로 Employee를 조회해 role을 확정한다
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // TODO: 실제 authOptions 경로만 확인
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Employee.role 실제 허용값 (schema.prisma 주석 기준)
export type Role = "EMPLOYEE" | "DEPT_HEAD" | "AX_TEAM" | "C_LEVEL" | "EXECUTIVE" | "DATA_PLATFORM";

export type SessionUser = {
  id: string; employeeId: string; email: string; name: string;
  role: Role; department: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  const emp = await prisma.employee.findUnique({ where: { email } });
  if (!emp || !emp.isActive) return null;
  return {
    id: emp.id, employeeId: emp.employeeId, email: emp.email,
    name: emp.name, role: emp.role as Role, department: emp.department,
  };
}

/** 역할 체크 — 개발 단계에서는 로그인만 확인, 역할 제한 없음 */
export async function requireRole(..._roles: Role[]) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 }) };
  return { user };
}
