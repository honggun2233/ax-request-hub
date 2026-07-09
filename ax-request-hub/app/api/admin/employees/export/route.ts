import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/src/lib/db"
import * as XLSX from "xlsx"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["AX_TEAM", "C_LEVEL"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const employees = await db.employee.findMany({
    where: { isActive: true },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  })

  const data = employees.map(e => ({
    "사번": e.employeeId,
    "이름": e.name,
    "부서": e.department,
    "직급": e.jobTitle,
    "레벨": e.currentLevel,
    "역할": e.role,
    "부여일": e.levelGrantedAt ? new Date(e.levelGrantedAt).toLocaleDateString("ko-KR") : "",
    "이메일": e.email,
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "직원레벨현황")
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ai-level-status-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
