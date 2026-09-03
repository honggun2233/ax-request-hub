import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface PolicyCache {
  decision: string
  reason: string
  expiresAt: number
}

const policyCache = new Map<string, PolicyCache>()

function getCached(key: string): PolicyCache | null {
  const entry = policyCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    policyCache.delete(key)
    return null
  }
  return entry
}

function setCache(key: string, decision: string, reason: string) {
  policyCache.set(key, { decision, reason, expiresAt: Date.now() + 60_000 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { agentId, employeeId } = body as {
      agentId: string
      employeeId: string
      departmentId?: string
    }

    const cacheKey = `${agentId}:${employeeId}`

    const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } })

    if (!agent) {
      return NextResponse.json({
        data: { decision: "BLOCK", reason: "에이전트를 찾을 수 없음", warnings: [] },
        message: "",
        error: "",
      })
    }

    const stage = agent.lifecycleStage

    if (stage === "RETIRED") {
      return NextResponse.json({
        data: { decision: "BLOCK", reason: "폐기된 에이전트", warnings: [] },
        message: "",
        error: "",
      })
    }

    if (["GATE1", "GATE2", "GATE3"].includes(stage)) {
      return NextResponse.json({
        data: {
          decision: "BLOCK",
          reason: `심의 미통과 에이전트 (${stage})`,
          warnings: [],
        },
        message: "",
        error: "",
      })
    }

    if (stage === "DEGRADED") {
      prisma.policyDecisionLog
        .create({
          data: {
            agentId,
            employeeId,
            decision: "WARN",
            reason: "성능 저하 상태 (제한적 운영 중)",
          },
        })
        .catch(console.error)

      return NextResponse.json({
        data: {
          decision: "WARN",
          reason: "성능 저하 상태 (제한적 운영 중)",
          warnings: [],
        },
        message: "",
        error: "",
      })
    }

    const autoBlockedAlert = await prisma.usageAlert.findFirst({
      where: {
        employeeId,
        alertType: "OVER_LIMIT",
        ownerApprovalStatus: "AUTO_BLOCKED",
      },
      orderBy: { createdAt: "desc" },
    })

    if (autoBlockedAlert) {
      prisma.policyDecisionLog
        .create({
          data: {
            agentId,
            employeeId,
            decision: "BLOCK",
            reason: "비용 유예 기간 만료, 오너 미승인",
          },
        })
        .catch(console.error)

      return NextResponse.json({
        data: {
          decision: "BLOCK",
          reason: "비용 유예 기간 만료, 오너 미승인",
          warnings: [],
        },
        message: "",
        error: "",
      })
    }

    const pendingAlert = await prisma.usageAlert.findFirst({
      where: {
        employeeId,
        alertType: "OVER_LIMIT",
        ownerApprovalStatus: "PENDING",
        graceStartedAt: { not: null },
      },
      orderBy: { createdAt: "desc" },
    })

    if (pendingAlert) {
      const newCount = pendingAlert.callsSinceOverage + 1
      await prisma.usageAlert.update({
        where: { id: pendingAlert.id },
        data: { callsSinceOverage: newCount },
      })

      const reason = `한도 초과 유예 중 (${newCount}회차)`

      prisma.policyDecisionLog
        .create({
          data: { agentId, employeeId, decision: "WARN", reason },
        })
        .catch(console.error)

      return NextResponse.json({
        data: { decision: "WARN", reason, warnings: [] },
        message: "",
        error: "",
      })
    }

    // 상태 체크 통과 — 비용 집계 전 캐시 확인 (사용량 집계 쿼리만 건너뜀)
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({
        data: { decision: cached.decision, reason: cached.reason, warnings: [] },
        message: "",
        error: "",
      })
    }

    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    const currentLevel = employee?.currentLevel ?? "L0"

    const [usageRecords, tokenPolicy] = await Promise.all([
      prisma.usageRecord.findMany({ where: { employeeId, yearMonth } }),
      prisma.tokenPolicy.findFirst({
        where: { scope: "LEVEL", level: currentLevel, isActive: true },
      }).then((p) =>
        p ?? prisma.tokenPolicy.findFirst({ where: { scope: "COMPANY", isActive: true } })
      ),
    ])

    const totalUsed = usageRecords.reduce((s, r) => s + r.tokenUsed, 0)

    if (tokenPolicy && tokenPolicy.monthlyLimit > 0) {
      const usagePct = Math.round((totalUsed / tokenPolicy.monthlyLimit) * 100)
      const warningThreshold = tokenPolicy.warningThreshold ?? 80
      if (usagePct >= warningThreshold) {
        const reason = `사용량 ${usagePct}% 도달 (${warningThreshold}% 경고)`

        prisma.policyDecisionLog
          .create({
            data: { agentId, employeeId, decision: "WARN", reason },
          })
          .catch(console.error)

        return NextResponse.json({
          data: { decision: "WARN", reason, warnings: [] },
          message: "",
          error: "",
        })
      }
    }

    const reason = "정상 범위"

    prisma.policyDecisionLog
      .create({
        data: { agentId, employeeId, decision: "ALLOW", reason },
      })
      .catch(console.error)

    setCache(cacheKey, "ALLOW", reason)

    return NextResponse.json({
      data: { decision: "ALLOW", reason, warnings: [] },
      message: "",
      error: "",
    })
  } catch (error) {
    console.error("[policy-check] unhandled error:", error)
    return NextResponse.json(
      {
        data: { decision: "BLOCK", reason: "정책 판정 오류", warnings: [] },
        message: "",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
