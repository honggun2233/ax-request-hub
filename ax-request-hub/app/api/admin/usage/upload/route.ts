import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

// CSV 열 후보 (대소문자·공백 허용)
const COL_ALIASES: Record<string, string[]> = {
  email:      ['email', 'e-mail', '이메일', 'employeeemail', 'employee_email'],
  service:    ['service', '서비스', 'servicetype'],
  yearMonth:  ['yearmonth', 'year_month', '월', 'month', 'yyyymm'],
  tokenUsed:  ['tokenused', 'token_used', '토큰', 'tokens', '사용토큰'],
  costKrw:    ['costkrw', 'cost_krw', '비용', 'cost', '금액(원)', '금액'],
}

const VALID_SERVICES = ['CLAUDE_ENTERPRISE', 'GPT_CHAT', 'GPT_EXCEL', 'GEMINI', 'ONPREM_QWEN']

function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[\s_\-]/g, '')
}

function detectColumn(headers: string[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    const idx = headers.findIndex(h => aliases.includes(normalizeKey(h)))
    if (idx !== -1) result[field] = idx
  }
  return result
}

function parseCSV(text: string): string[][] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
}

export async function POST(req: NextRequest) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const mode = (form.get('mode') as string) ?? 'upsert'  // upsert | append

    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'CSV 파일만 지원합니다 (.csv)' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length < 2) return NextResponse.json({ error: '데이터 행이 없습니다' }, { status: 400 })

    const headers = rows[0]
    const colMap = detectColumn(headers)

    const required = ['email', 'service', 'yearMonth', 'tokenUsed']
    const missing = required.filter(f => colMap[f] === undefined)
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `필수 열이 없습니다: ${missing.join(', ')}. 필요 열: email, service, yearMonth, tokenUsed, costKrw` },
        { status: 400 }
      )
    }

    const dataRows = rows.slice(1)
    const errors: string[] = []
    let upserted = 0; let skipped = 0

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const lineNo = i + 2

      const email     = row[colMap.email]?.trim()
      const rawSvc    = row[colMap.service]?.trim().toUpperCase()
      const yearMonth = row[colMap.yearMonth]?.trim()
      const tokenUsed = parseInt(row[colMap.tokenUsed] ?? '0', 10)
      const costKrw   = parseFloat(row[colMap.costKrw ?? -1] ?? '0') || 0

      if (!email || !rawSvc || !yearMonth) { errors.push(`행 ${lineNo}: 필수값 누락`); skipped++; continue }
      if (!VALID_SERVICES.includes(rawSvc)) { errors.push(`행 ${lineNo}: service '${rawSvc}' 허용되지 않음`); skipped++; continue }
      if (!/^\d{4}-\d{2}$/.test(yearMonth)) { errors.push(`행 ${lineNo}: yearMonth 형식 오류 (YYYY-MM 필요)`); skipped++; continue }
      if (isNaN(tokenUsed) || tokenUsed < 0) { errors.push(`행 ${lineNo}: tokenUsed 숫자 오류`); skipped++; continue }

      const employee = await prisma.employee.findUnique({ where: { email }, select: { id: true } })
      if (!employee) { errors.push(`행 ${lineNo}: 직원 미존재 (${email})`); skipped++; continue }

      await prisma.usageRecord.upsert({
        where: { employeeId_service_yearMonth: { employeeId: employee.id, service: rawSvc, yearMonth } },
        update: mode === 'upsert'
          ? { tokenUsed, costKrw, inputById: employee.id }
          : { tokenUsed: { increment: tokenUsed }, costKrw: { increment: costKrw } },
        create: {
          employeeId: employee.id,
          service:    rawSvc,
          yearMonth,
          tokenUsed,
          costKrw,
          inputById:  employee.id,
        },
      })
      upserted++
    }

    return NextResponse.json({
      success: true,
      upserted,
      skipped,
      errors: errors.slice(0, 20),  // 최대 20개만 반환
      total: dataRows.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })
  }
}
