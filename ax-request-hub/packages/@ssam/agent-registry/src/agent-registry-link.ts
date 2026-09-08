import { Prisma } from '@prisma/client'

/**
 * Agent와 AgentRegistry를 같은 트랜잭션 내에서 생성한 직후 호출.
 * Gate3 승인 → ACTIVE 전환 시점에 Agent.agentRegistryId를 자동 세팅.
 */
export async function linkAgentToRegistry(
  tx: Prisma.TransactionClient,
  agentId: string,
  agentRegistryId: string,
) {
  await tx.agent.update({
    where: { id: agentId },
    data: { agentRegistryId },
  })
}
