import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

// GET /api/registry/[id]/data-deps
// 에이전트가 의존하는 데이터 자산 목록 (B방향: AgentRegistry → DataAsset)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const { id } = await params

  const agent = await prisma.agentRegistry.findUnique({
    where: { id },
    select: { id: true, agentName: true, lifecycleStage: true, projectId: true },
  })
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  // ── Path 1: AgentRegistry → AgentDataLink → DataAsset (직접 연결) ──
  const directLinks = await prisma.agentDataLink.findMany({
    where: { agentId: id },
    include: {
      dataAsset: {
        select: {
          id: true, name: true, classification: true,
          ownerDept: true, isActive: true, deliveryModes: true,
        },
      },
    },
  })

  // ── Path 2: AgentRegistry → Project → DataRequest(활성) → DataAsset ──
  const activeStatuses = ['APPROVED', 'COLLECTING', 'PROVISIONED']
  const viaProject = agent.projectId
    ? await prisma.dataRequest.findMany({
        where: {
          projectId: agent.projectId,
          status: { in: activeStatuses },
          assetId: { not: null },
        },
        include: {
          asset: {
            select: {
              id: true, name: true, classification: true,
              ownerDept: true, isActive: true, deliveryModes: true,
            },
          },
          provision: { select: { expiresAt: true, revokedAt: true } },
        },
      })
    : []

  // ── 병합 (assetId 기준 중복 제거, 직접 링크 우선) ──
  const seen = new Map<string, object>()

  for (const link of directLinks) {
    const a = link.dataAsset
    seen.set(a.id, {
      assetId:        a.id,
      assetName:      a.name,
      classification: a.classification,
      ownerDept:      a.ownerDept,
      isActive:       a.isActive,
      deliveryModes:  a.deliveryModes,
      connectionType: 'DIRECT',
      accessLevel:    link.accessLevel,
      requestStatus:  null,
      expiresAt:      null,
      revokedAt:      null,
    })
  }

  for (const req of viaProject) {
    if (!req.asset || seen.has(req.asset.id)) continue
    const a = req.asset
    seen.set(a.id, {
      assetId:        a.id,
      assetName:      a.name,
      classification: a.classification,
      ownerDept:      a.ownerDept,
      isActive:       a.isActive,
      deliveryModes:  a.deliveryModes,
      connectionType: 'VIA_PROJECT',
      accessLevel:    null,
      requestStatus:  req.status,
      expiresAt:      req.provision?.expiresAt ?? null,
      revokedAt:      req.provision?.revokedAt ?? null,
    })
  }

  const deps = Array.from(seen.values()) as Array<{
    assetId: string; assetName: string; classification: string
    ownerDept: string; isActive: boolean; deliveryModes: string
    connectionType: string; accessLevel: string | null
    requestStatus: string | null; expiresAt: string | null; revokedAt: string | null
  }>

  // 기밀등급 높은 순 정렬 (G1 > G2 > G3)
  const clsOrder: Record<string, number> = { G1: 0, G2: 1, G3: 2 }
  deps.sort((a, b) => (clsOrder[a.classification] ?? 3) - (clsOrder[b.classification] ?? 3))

  // 회수/만료된 자산 여부
  const revokedCount = deps.filter(d => d.revokedAt).length
  const expiredCount = deps.filter(d =>
    d.expiresAt && new Date(d.expiresAt) < new Date() && !d.revokedAt
  ).length

  return NextResponse.json({
    agentId:    agent.id,
    agentName:  agent.agentName,
    lifecycleStage: agent.lifecycleStage,
    deps,
    summary: {
      total:        deps.length,
      revokedCount,
      expiredCount,
      g1Count:      deps.filter(d => d.classification === 'PUBLIC').length,
    },
  })
}
