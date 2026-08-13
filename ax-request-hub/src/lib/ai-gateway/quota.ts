import { db } from '@/src/lib/db'
import type { QuotaCheckResult, ProviderKey } from './types'

const SERVICE_MAP: Record<ProviderKey, string> = {
  anthropic: 'Claude',
  openai: 'GPT Enterprise',
  gemini: 'Gemini',
}

export async function checkQuota(
  employeeId: string,
  level: string,
  provider: ProviderKey,
): Promise<QuotaCheckResult> {
  const yearMonth = new Date().toISOString().slice(0, 7)
  const service = SERVICE_MAP[provider]

  const [policy, usageRecords] = await Promise.all([
    db.tokenPolicy.findFirst({
      where: {
        isActive: true,
        service,
        OR: [
          { scope: 'LEVEL', level },
          { scope: 'COMPANY' },
        ],
      },
      orderBy: { scope: 'asc' }, // COMPANY < LEVEL — LEVEL 우선
    }),
    db.usageRecord.findMany({
      where: { employeeId, yearMonth },
    }),
  ])

  const used = usageRecords.reduce((s, r) => s + r.tokenUsed, 0)
  const limit = policy?.monthlyLimit ?? 0

  if (limit === 0) {
    // 정책 미설정 → 무제한 허용
    return { allowed: true, used, limit: 0, remaining: Infinity, pct: 0 }
  }

  const remaining = Math.max(0, limit - used)
  const pct = Math.round((used / limit) * 100)

  return { allowed: used < limit, used, limit, remaining, pct }
}

export async function recordUsage(params: {
  employeeId: string
  inputById: string
  provider: ProviderKey
  inputTokens: number
  outputTokens: number
  totalTokens: number
  level: string
}) {
  const yearMonth = new Date().toISOString().slice(0, 7)
  const service = SERVICE_MAP[params.provider]

  await db.usageRecord.upsert({
    where: {
      employeeId_service_yearMonth: {
        employeeId: params.employeeId,
        service,
        yearMonth,
      },
    },
    update: {
      tokenUsed: { increment: params.totalTokens },
    },
    create: {
      employeeId: params.employeeId,
      service,
      yearMonth,
      tokenUsed: params.totalTokens,
      costKrw: 0,
      inputById: params.inputById,
    },
  })

  // 80% / 100% 경고 알림 생성
  const afterUsage = await db.usageRecord.findMany({
    where: { employeeId: params.employeeId, yearMonth },
  })
  const totalUsed = afterUsage.reduce((s, r) => s + r.tokenUsed, 0)
  const policy = await db.tokenPolicy.findFirst({
    where: {
      isActive: true,
      service,
      OR: [{ scope: 'LEVEL', level: params.level }, { scope: 'COMPANY' }],
    },
    orderBy: { scope: 'asc' },
  })

  if (policy?.monthlyLimit && policy.monthlyLimit > 0) {
    const pct = (totalUsed / policy.monthlyLimit) * 100
    for (const threshold of [80, 100]) {
      if (pct >= threshold) {
        const alertId = `${params.employeeId}-${service}-${yearMonth}-${threshold}`
        await db.usageAlert.upsert({
          where: { id: alertId },
          update: {},
          create: {
            id: alertId,
            employeeId: params.employeeId,
            service,
            yearMonth,
            alertType: `${threshold}_PCT`,
            acknowledged: false,
          },
        }).catch(() => {}) // 중복 무시
      }
    }
  }
}
