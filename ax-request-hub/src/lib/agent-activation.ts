import { Prisma } from '@prisma/client'
import { linkAgentToRegistry } from './agent-registry-link'

// PrismaClient와 interactive-transaction client 공통 인터페이스
type DbClient = Prisma.TransactionClient

interface ActivateOpts {
  operatorTrustScore?: number
  operatorComment?: string
  sam30dAccuracy?: number
}

/**
 * AgentRegistry 레코드를 ACTIVE 상태로 전환하는 공용 함수.
 * registry PATCH(운용역 직접 전환)와 council decide(위원회 승인 전환) 양쪽에서 호출된다.
 *
 * 부수 효과:
 *  - gate2Passed / gate2PassedAt 세팅
 *  - opts 제공 시 operatorTrustScore / operatorComment / sam30dAccuracy 세팅
 *  - 연결 과제(projectId)가 있으면 Project.status → 'production' 동기화
 *  - 같은 이름의 Agent 레코드에 agentRegistryId 자동 연결
 */
export async function activateAgent(
  tx: DbClient,
  agentId: string,
  opts?: ActivateOpts,
) {
  const now = new Date()

  const updateData: Prisma.AgentRegistryUpdateInput = {
    lifecycleStage: 'ACTIVE',
    gate2Passed: true,
    gate2PassedAt: now,
    updatedAt: now,
    ...(opts?.operatorTrustScore !== undefined && {
      operatorTrustScore: opts.operatorTrustScore,
      operatorComment: opts.operatorComment,
      sam30dAccuracy: opts.sam30dAccuracy,
    }),
  }

  const agent = await tx.agentRegistry.update({
    where: { id: agentId },
    data: updateData,
  })

  if (agent.projectId) {
    await tx.project.update({
      where: { id: agent.projectId },
      data: { status: 'production' },
    }).catch(() => {})
  }

  const linkedAgent = await tx.agent.findFirst({
    where: { name: agent.agentName, agentRegistryId: null },
  })
  if (linkedAgent) {
    await linkAgentToRegistry(tx, linkedAgent.id, agent.id).catch(() => {})
  }

  return agent
}
