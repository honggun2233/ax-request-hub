import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/admin/agents/:id/kpi-record
// 월별 KPI 실적 입력 — achieveRate, performMatrix, kpiMissCount 자동 계산
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: agentId } = await params
    const body = await req.json()
    const { recordMonth, actualValue, tokenCost, note, recordedBy } = body

    if (!recordMonth || actualValue == null || !recordedBy) {
      return NextResponse.json(
        { error: 'recordMonth, actualValue, recordedBy are required' },
        { status: 400 }
      )
    }

    // 에이전트 조회
    const agent = await prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const targetValue = agent.kpiTarget ?? 100
    const achieveRate = (Number(actualValue) / targetValue) * 100

    // 해당 월 평균 tokenCost 산출 (performMatrix 판정에 사용)
    const avgRecord = await (prisma.agentKpiRecord as any).aggregate({
      _avg: { tokenCost: true },
    })
    const avgTokenCost: number = avgRecord._avg?.tokenCost ?? 0

    // performMatrix 자동 판정
    let performMatrix: string
    const cost = tokenCost != null ? Number(tokenCost) : 0
    if (achieveRate >= 60 && cost <= avgTokenCost) {
      performMatrix = 'STAR'
    } else if (achieveRate >= 60 && cost > avgTokenCost) {
      performMatrix = 'OPTIMIZE'
    } else if (achieveRate < 60 && cost <= avgTokenCost) {
      performMatrix = 'IMPROVE'
    } else {
      performMatrix = 'RETIRE'
    }

    // kpiMissCount 업데이트
    const newMissCount = achieveRate < 60 ? (agent.kpiMissCount ?? 0) + 1 : 0

    // performanceFlag 업데이트
    let performanceFlag: string | null = null
    if (newMissCount >= 3) {
      performanceFlag = 'RETIRE_CANDIDATE'
    } else if (newMissCount === 2) {
      performanceFlag = 'WARNING'
    }

    // AgentKpiRecord 생성
    const record = await prisma.agentKpiRecord.create({
      data: {
        agentId,
        recordMonth,
        actualValue: Number(actualValue),
        targetValue,
        achieveRate,
        tokenCost: tokenCost != null ? Number(tokenCost) : null,
        performMatrix,
        note: note ?? null,
        recordedBy,
      },
    })

    // Agent 업데이트
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        kpiLastScore: achieveRate,
        kpiMissCount: newMissCount,
        performanceFlag,
      },
    })

    // AuditLog 기록
    await prisma.auditLog.create({
      data: {
        entityType: 'AgentKpiRecord',
        entityId: record.id,
        action: 'KPI_RECORD_CREATED',
        actorEmail: recordedBy,
        detail: JSON.stringify({
          agentId,
          recordMonth,
          achieveRate,
          performMatrix,
          newMissCount,
          performanceFlag,
        }),
      },
    })

    return NextResponse.json(
      { record, achieveRate, performMatrix, kpiMissCount: newMissCount, performanceFlag },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('[admin/agents/:id/kpi-record POST]', err)
    return NextResponse.json({ error: err?.message ?? 'unknown' }, { status: 500 })
  }
}
