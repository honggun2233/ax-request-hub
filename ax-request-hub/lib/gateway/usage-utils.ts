/**
 * 월별 토큰 사용량 집계 유틸 — quota.ts·policy.ts 공통 사용
 *
 * - service 지정 시: 특정 AI 서비스 쿼터 (checkQuota 경로)
 * - service 미지정 시: 전사 통합 집계 (checkPolicy 경로, service='ALL' 정책 대응)
 */
import { prisma } from '@/lib/prisma'

export async function getMonthlyTokenUsed(
  employeeId: string,
  yearMonth: string,
  service?: string,
): Promise<number> {
  const records = await prisma.usageRecord.findMany({
    where: { employeeId, yearMonth, ...(service ? { service } : {}) },
  })
  return records.reduce((s, r) => s + r.tokenUsed, 0)
}
