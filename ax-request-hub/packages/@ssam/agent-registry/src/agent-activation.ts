import { Prisma } from '@prisma/client'
import { linkAgentToRegistry } from './agent-registry-link'

// PrismaClient? interactive-transaction client 怨듯넻 ?명꽣?섏씠??
type DbClient = Prisma.TransactionClient

interface ActivateOpts {
  operatorTrustScore?: number
  operatorComment?: string
  sam30dAccuracy?: number
}

/**
 * AgentRegistry ?덉퐫?쒕? ACTIVE ?곹깭濡??꾪솚?섎뒗 怨듭슜 ?⑥닔.
 * registry PATCH(?댁슜??吏곸젒 ?꾪솚)? council decide(?꾩썝???뱀씤 ?꾪솚) ?묒そ?먯꽌 ?몄텧?쒕떎.
 *
 * 遺???④낵:
 *  - gate2Passed / gate2PassedAt ?명똿
 *  - opts ?쒓났 ??operatorTrustScore / operatorComment / sam30dAccuracy ?명똿
 *  - ?곌껐 怨쇱젣(projectId)媛 ?덉쑝硫?Project.status ??'production' ?숆린??
 *  - 媛숈? ?대쫫??Agent ?덉퐫?쒖뿉 agentRegistryId ?먮룞 ?곌껐
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
    })
  }

  const linkedAgent = await tx.agent.findFirst({
    where: { name: agent.agentName, agentRegistryId: null },
  })
  if (linkedAgent) {
    await linkAgentToRegistry(tx, linkedAgent.id, agent.id)
  }

  return agent
}
