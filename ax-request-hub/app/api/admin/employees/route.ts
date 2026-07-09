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

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  const applications = await db.levelApplication.findMany({
    where: status ? { status } : {},
    include: { employee: true, reviewedBy: true },
    orderBy: { createdAt: "desc" },
  })

  const employees = await db.employee.findMany({
    where: { isActive: true },
    orderBy: { department: "asc" },
  })

  return NextResponse.json({ applications, employees })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !["AX_TEAM"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File
  if (!file) return NextResponse.json({ error: "파일 없음" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(sheet)

  let created = 0, updated = 0, errors: string[] = []
  const adminId = (session.user as any).id

  for (const row of rows) {
    try {
      const employeeId = String(row["사번"] || row["employeeId"] || "").trim()
      const name = String(row["이름"] || row["name"] || "").trim()
      const department = String(row["부서"] || row["department"] || "").trim()
      const level = String(row["레벨"] || row["level"] || "L0").trim()
      const email = String(row["이메일"] || row["email"] || `${employeeId}@samsungam.com`).trim()

      if (!employeeId || !name) { errors.push(`사번/이름 누락: ${JSON.stringify(row)}`); continue }

      const existing = await db.employee.findUnique({ where: { employeeId } })
      if (existing) {
        const oldLevel = existing.currentLevel
        await db.employee.update({
          where: { employeeId },
          data: { name, department, currentLevel: level, levelGrantedAt: new Date() },
        })
        if (oldLevel !== level) {
          await db.levelHistory.create({
            data: { employeeId: existing.id, fromLevel: oldLevel, toLevel: level, reason: "엑셀 일괄 업로드", changedById: adminId },
          })
        }
        updated++
      } else {
        await db.employee.create({
          data: { employeeId, name, email, department, currentLevel: level, levelGrantedAt: new Date() },
        })
        created++
      }
    } catch (e: any) {
      errors.push(e.message)
    }
  }

  return NextResponse.json({ created, updated, errors })
}
