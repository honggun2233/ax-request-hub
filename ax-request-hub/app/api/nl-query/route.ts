import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { anthropic, MODEL } from '@/src/lib/claude'
import { db } from '@/src/lib/db'

const SCHEMA = `
AX Hub 데이터베이스 주요 테이블 (Prisma/SQLite):

1. Project — AI 과제
   id, title(과제명), department(부서), status(submitted/evaluated/pilot/approved/rejected/active/deprecated/retired),
   confidentialityLevel(G1/G2/G3), totalScore(AI 평가점수), createdAt, updatedAt

2. AgentRegistry — AI 에이전트 레지스트리
   id, agentName(에이전트명), lifecycleStage(DEVELOPING/GATE1/GATE2/GATE3/ACTIVE/DEGRADED/RETIRED),
   operatorTrustScore(신뢰점수 0-100), sam30dAccuracy(30일 정확도), createdAt

3. Employee — 직원
   id, name, department(부서), role(EMPLOYEE/DEPT_HEAD/EXECUTIVE/DATA_PLATFORM/AX_TEAM),
   currentLevel(L0/L1/L2/L3/L4), isActive, createdAt

4. DataRequest — 데이터 신청
   id, requestedById, projectId, assetId, purpose(목적),
   status(PENDING/APPROVED/REJECTED/PROVISIONED), createdAt

5. LevelApplication — AI 레벨 신청
   id, employeeId, requestedLevel(L1~L4), status(PENDING/APPROVED/REJECTED), createdAt

6. LevelHistory — 레벨 변경 이력
   id, employeeId, fromLevel, toLevel, reason, createdAt

7. ToolAccount — AI 도구 계정
   id, employeeId, toolType(GPT_CHAT/GPT_EXCEL/GEMINI), toolTier,
   status(PENDING/APPROVED/ACTIVE/SUSPENDED/RETURNED), createdAt

8. DepartmentQuota — 부서별 AI 도구 쿼터
   id, department(부서), toolType, totalQuota(총 쿼터), managedBy(부서장 이메일), createdAt

SQLite 날짜 함수 사용 (date(), datetime(), strftime()).
SELECT만 허용. LIMIT 100 권장. 결과 컬럼에는 한국어 alias 사용 권장.
`

function isSafeSelect(sql: string): boolean {
  const upper = sql.trim().toUpperCase()
  if (!upper.startsWith('SELECT')) return false
  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'PRAGMA', 'ATTACH', 'DETACH']
  return !forbidden.some(kw => new RegExp(`\\b${kw}\\b`).test(upper))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any)?.role
  if (!['AX_TEAM', 'C_LEVEL', 'EXECUTIVE'].includes(role)) {
    return NextResponse.json({ error: '어드민 권한이 필요합니다.' }, { status: 403 })
  }

  const { question } = await req.json()
  if (!question?.trim()) return NextResponse.json({ error: '질문을 입력해주세요.' }, { status: 400 })

  // ReAct 루프: 최대 3회 시도 (SQL 생성 → 실행 → 실패 시 에러 피드백 → 재시도)
  const MAX_ATTEMPTS = 3
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    {
      role: 'user',
      content: `${SCHEMA}\n\n질문: ${question}\n\n출력 JSON:\n{"sql": "SELECT ...", "explanation": "한국어 1~2문장 설명"}`,
    },
  ]

  let sql = ''
  let explanation = ''
  let attempts = 0

  while (attempts < MAX_ATTEMPTS) {
    attempts++

    // Observe → Think (Claude가 SQL 생성)
    let raw = ''
    try {
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: '당신은 SQLite 전문가입니다. 자연어 질문을 SQL로 변환해 JSON으로만 출력하세요. 반드시 SELECT만 사용하세요.',
        messages,
      })
      raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    } catch (err: any) {
      return NextResponse.json({ error: `SQL 생성 실패: ${err?.message}` }, { status: 500 })
    }

    messages.push({ role: 'assistant', content: raw })

    const jsonMatch = raw.match(/\{[\s\S]*?\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        sql = parsed.sql ?? ''
        explanation = parsed.explanation ?? ''
      } catch {}
    }

    if (!sql) {
      messages.push({ role: 'user', content: 'SQL이 생성되지 않았습니다. 다시 JSON 형식으로 출력하세요.' })
      continue
    }

    if (!isSafeSelect(sql)) {
      return NextResponse.json({ error: 'SELECT만 허용됩니다.', sql }, { status: 400 })
    }

    // Act (SQL 실행)
    try {
      const rows = await db.$queryRawUnsafe(sql)
      const serialized = JSON.parse(JSON.stringify(rows, (_k, v) =>
        typeof v === 'bigint' ? Number(v) : v
      ))
      return NextResponse.json({ sql, explanation, rows: serialized, error: null, attempts })
    } catch (err: any) {
      const errMsg = err?.message ?? 'SQL 오류'
      if (attempts < MAX_ATTEMPTS) {
        // 에러 피드백 → 다음 루프에서 Claude가 수정
        messages.push({
          role: 'user',
          content: `SQL 실행 오류가 발생했습니다: ${errMsg}\n\n수정된 SQL을 JSON으로 다시 출력하세요.`,
        })
        sql = ''
      } else {
        return NextResponse.json({ sql, explanation, rows: [], error: `SQL 실행 오류(${attempts}회 시도): ${errMsg}`, attempts })
      }
    }
  }

  return NextResponse.json({ sql, explanation, rows: [], error: 'SQL 생성에 실패했습니다.', attempts })
}
