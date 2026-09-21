import { prisma } from '@/lib/prisma'
import { checkProdEligibility as _check, displayName } from '@ssam/agents'

export type { EligibilityCheck } from '@ssam/agents'
export { displayName }

export async function checkProdEligibility(agentId: string) {
  return _check(prisma, agentId)
}
