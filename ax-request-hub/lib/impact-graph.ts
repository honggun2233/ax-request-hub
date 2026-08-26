import { prisma } from '@/lib/prisma'

export const HIGH_RISK_STAGES = new Set(['GATE2', 'GATE3', 'PROD', 'OPERATION'])
export const MED_RISK_STAGES  = new Set(['GATE1', 'PILOT'])

export function riskLevel(stage: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (HIGH_RISK_STAGES.has(stage)) return 'HIGH'
  if (MED_RISK_STAGES.has(stage))  return 'MEDIUM'
  return 'LOW'
}

export interface AffectedAgent {
  agentId:        string
  agentName:      string
  lifecycleStage: string
  connectionType: 'DIRECT' | 'VIA_PROJECT'
  projectName:    string | null
  riskLevel:      'HIGH' | 'MEDIUM' | 'LOW'
}

// 데이터 자산 회수 시 영향받는 에이전트 목록 (2-path 그래프 탐색)
// Path 1: DataAsset → AgentDataLink → AgentRegistry
// Path 2: DataAsset → DataRequest(활성) → Project → AgentRegistry
export async function getAffectedAgents(assetId: string): Promise<AffectedAgent[]> {
  const activeStatuses = ['APPROVED', 'COLLECTING', 'PROVISIONED']

  const [directLinks, viaRequests] = await Promise.all([
    prisma.agentDataLink.findMany({
      where: { dataAssetId: assetId },
      include: {
        agent: {
          select: { id: true, agentName: true, lifecycleStage: true, projectId: true },
        },
      },
    }),
    prisma.dataRequest.findMany({
      where: { assetId, status: { in: activeStatuses } },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            agentRegistries: {
              select: { id: true, agentName: true, lifecycleStage: true },
            },
          },
        },
      },
    }),
  ])

  const seen = new Map<string, AffectedAgent>()

  for (const link of directLinks) {
    const a = link.agent
    seen.set(a.id, {
      agentId:        a.id,
      agentName:      a.agentName,
      lifecycleStage: a.lifecycleStage ?? 'UNKNOWN',
      connectionType: 'DIRECT',
      projectName:    null,
      riskLevel:      riskLevel(a.lifecycleStage ?? ''),
    })
  }

  for (const req of viaRequests) {
    if (!req.project) continue
    for (const a of req.project.agentRegistries) {
      if (seen.has(a.id)) continue
      seen.set(a.id, {
        agentId:        a.id,
        agentName:      a.agentName,
        lifecycleStage: a.lifecycleStage ?? 'UNKNOWN',
        connectionType: 'VIA_PROJECT',
        projectName:    req.project.title,
        riskLevel:      riskLevel(a.lifecycleStage ?? ''),
      })
    }
  }

  const agents = Array.from(seen.values())
  const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  agents.sort((a, b) => order[a.riskLevel] - order[b.riskLevel])
  return agents
}
