import { prisma } from '@/lib/prisma'

// 운영규정 제10조: 초고위험(4단계) 추가 — 등록 차단·즉시 운영 중지
export const ULTRA_HIGH_RISK_STAGES = new Set(['ULTRA_HIGH_BLOCKED'])
export const HIGH_RISK_STAGES       = new Set(['GATE2', 'GATE3', 'PROD', 'OPERATION'])
export const MED_RISK_STAGES        = new Set(['GATE1', 'PILOT'])

export function riskLevel(stage: string): 'ULTRA_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (ULTRA_HIGH_RISK_STAGES.has(stage)) return 'ULTRA_HIGH'
  if (HIGH_RISK_STAGES.has(stage))       return 'HIGH'
  if (MED_RISK_STAGES.has(stage))        return 'MEDIUM'
  return 'LOW'
}

export interface AffectedAgent {
  agentId:        string
  agentName:      string
  lifecycleStage: string
  connectionType: 'DIRECT' | 'VIA_PROJECT' | 'VIA_DERIVED_ASSET'
  projectName:    string | null
  riskLevel:      'ULTRA_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW'
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

  // ── Path 3: DataAsset → derivedAssets → (Path 1 재귀) ──────────────────────
  const derivedAssets = await prisma.dataAsset.findMany({
    where: { derivedFrom: { some: { id: assetId } } },
    select: { id: true },
  })
  for (const derived of derivedAssets) {
    const derivedLinks = await prisma.agentDataLink.findMany({
      where: { dataAssetId: derived.id },
      include: {
        agent: { select: { id: true, agentName: true, lifecycleStage: true } },
      },
    })
    for (const link of derivedLinks) {
      const a = link.agent
      if (seen.has(a.id)) continue
      seen.set(a.id, {
        agentId:        a.id,
        agentName:      a.agentName,
        lifecycleStage: a.lifecycleStage ?? 'UNKNOWN',
        connectionType: 'VIA_DERIVED_ASSET',
        projectName:    null,
        riskLevel:      riskLevel(a.lifecycleStage ?? ''),
      })
    }
  }

  const agents = Array.from(seen.values())
  const order: Record<string, number> = { ULTRA_HIGH: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  agents.sort((a, b) => (order[a.riskLevel] ?? 3) - (order[b.riskLevel] ?? 3))
  return agents
}
