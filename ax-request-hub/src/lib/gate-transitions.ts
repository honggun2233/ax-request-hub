import { PrismaClient } from '@prisma/client'

/**
 * GATE3 전환 공통 로직 — PATCH /api/registry 와 sandbox-complete 가 공유.
 * gate3Passed / gate3PassedAt 세팅을 이 함수로만 처리한다.
 */
export function buildGate3UpdateData(now: Date): {
  gate3Passed: boolean
  gate3PassedAt: Date
} {
  return {
    gate3Passed: true,
    gate3PassedAt: now,
  }
}
