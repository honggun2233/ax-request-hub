/**
 * Policy Gateway 핵심 판정 로직
 * route.ts와 서버 사이드 내부 호출 양쪽에서 공유 — self-HTTP call 방지
 */
import { prisma } from '@/lib/prisma'

export type PolicyDecision = 'ALLOW' | 'WARN' | 'BLOCK'

export interface PolicyResult {
  decision: PolicyDecision
  reason: string
}

interface PolicyCache {
  decision: PolicyDecision
  reason: string
  expiresAt: number
}

// ALLOW 결과만 60초 캐시 — BLOCK은 항상 실시간 (상태 변경 즉시 반영)
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

function setCache(key: string, decision: PolicyDecision, reason: string) {
  policyCache.set(key, { decision, reason, expiresAt: Date.now() + 60_000 })
}

function logDecision(agentId: string, employeeId: string, decision: string, reason: string) {
  prisma.policyDecisionLog
    .create({ data: { agentId, employeeId, decision, reason } })
    .catch(console.error)
}

export async function checkPolicy(agentId: string, employeeId: string): Promise<PolicyResult> {
  try {
    const cacheKey = `${agentId}:${employeeId}`

    const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } })
    if (!agent) return { decision: 'BLOCK', reason: '에이전트를 찾을 수 없음' }

    const stage = agent.lifecycleStage

    if (stage === 'RETIRED') {
      return { decision: 'BLOCK', reason: '폐기된 에이전트' }
    }

    if (['GATE1', 'GATE2', 'GATE3'].includes(stage)) {
      return { decision: 'BLOCK', reason: `심의 미통과 에이전트 (${stage})` }
    }

    if (stage === 'DEGRADED') {
      logDecision(agentId, employeeId, 'WARN', '성능 저하 상태 (제한적 운영 중)')
      return { decision: 'WARN', reason: '성능 저하 상태 (제한적 운영 중)' }
    }

    const autoBlockedAlert = await prisma.usageAlert.findFirst({
      where: { employeeId, alertType: 'OVER_LIMIT', ownerApprovalStatus: 'AUTO_BLOCKED' },
      orderBy: { createdAt: 'desc' },
    })
    if (autoBlockedAlert) {
      logDecision(agentId, employeeId, 'BLOCK', '비용 유예 기간 만료, 오너 미승인')
      return { decision: 'BLOCK', reason: '비용 유예 기간 만료, 오너 미승인' }
    }

    const pendingAlert = await prisma.usageAlert.findFirst({
      where: {
        employeeId,
        alertType: 'OVER_LIMIT',
        ownerApprovalStatus: 'PENDING',
        graceStartedAt: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (pendingAlert) {
      const newCount = pendingAlert.callsSinceOverage + 1
      await prisma.usageAlert.update({
        where: { id: pendingAlert.id },
        data: { callsSinceOverage: newCount },
      })
      const reason = `한도 초과 유예 중 (${newCount}회차)`
      logDecision(agentId, employeeId, 'WARN', reason)
      return { decision: 'WARN', reason }
    }

    // 상태 체크 통과 — 비용 집계 전 캐시 확인 (사용량 집계 쿼리만 건너뜀)
    const cached = getCached(cacheKey)
    if (cached) return { decision: cached.decision, reason: cached.reason }

    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
    const currentLevel = employee?.currentLevel ?? 'L0'

    const [usageRecords, tokenPolicy] = await Promise.all([
      prisma.usageRecord.findMany({ where: { employeeId, yearMonth } }),
      prisma.tokenPolicy
        .findFirst({ where: { scope: 'LEVEL', level: currentLevel, isActive: true } })
        .then(p => p ?? prisma.tokenPolicy.findFirst({ where: { scope: 'COMPANY', isActive: true } })),
    ])

    const totalUsed = usageRecords.reduce((s, r) => s + r.tokenUsed, 0)

    if (tokenPolicy && tokenPolicy.monthlyLimit > 0) {
      const usagePct = Math.round((totalUsed / tokenPolicy.monthlyLimit) * 100)
      const warningThreshold = tokenPolicy.warningThreshold ?? 80
      if (usagePct >= warningThreshold) {
        const reason = `사용량 ${usagePct}% 도달 (${warningThreshold}% 경고)`
        logDecision(agentId, employeeId, 'WARN', reason)
        return { decision: 'WARN', reason }
      }
    }

    const reason = '정상 범위'
    logDecision(agentId, employeeId, 'ALLOW', reason)
    setCache(cacheKey, 'ALLOW', reason)
    return { decision: 'ALLOW', reason }
  } catch (error) {
    console.error('[checkPolicy] unhandled error:', error)
    return { decision: 'BLOCK', reason: '정책 판정 오류' }
  }
}
