import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type NodeType = 'Agent' | 'Project' | 'DataAsset' | 'Employee'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const nodeId = searchParams.get('nodeId')
  const nodeType = searchParams.get('nodeType') as NodeType | null

  if (!nodeId || !nodeType) {
    return NextResponse.json({ error: 'nodeId and nodeType are required' }, { status: 400 })
  }

  const nodes: Record<string, unknown>[] = []
  const edges: { id: string; from: string; to: string; label: string }[] = []

  if (nodeType === 'Agent') {
    // AgentProjectLink: agentId → projectId (raw, stored as Agent.id / Project.id in seeded data)
    const links = await prisma.agentProjectLink.findMany({
      where: { agentId: nodeId },
      select: { id: true, projectId: true },
    })
    const projectIds = links.map(l => l.projectId)
    const [projects, dataReqs] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, title: true, status: true, department: true },
      }),
      prisma.dataRequest.findMany({
        where: { agentId: nodeId, assetId: { not: null } },
        select: { id: true, assetId: true },
      }),
    ])
    const assetIds = dataReqs.map(r => r.assetId!).filter(Boolean)
    const assets = await prisma.dataAsset.findMany({
      where: { id: { in: assetIds } },
      select: { id: true, name: true, classification: true, ownerDept: true },
    })
    const assetMap = new Map(assets.map(a => [a.id, a]))
    const projectMap = new Map(projects.map(p => [p.id, p]))

    for (const link of links) {
      const proj = projectMap.get(link.projectId)
      if (proj) {
        nodes.push({ id: proj.id, name: proj.title, status: proj.status, dept: proj.department, type: 'Project' })
        edges.push({ id: link.id, from: nodeId, to: proj.id, label: 'BELONGS_TO' })
      }
    }
    for (const req of dataReqs) {
      const asset = assetMap.get(req.assetId!)
      if (asset) {
        nodes.push({ id: asset.id, name: asset.name, secretLevel: asset.classification, dept: asset.ownerDept, type: 'DataAsset' })
        edges.push({ id: `dr-${req.id}`, from: nodeId, to: asset.id, label: 'CONSUMES' })
      }
    }
  }

  if (nodeType === 'Project') {
    const links = await prisma.agentProjectLink.findMany({
      where: { projectId: nodeId },
      select: { id: true, agentId: true },
    })
    const agentIds = links.map(l => l.agentId)
    const dataReqs = await prisma.dataRequest.findMany({
      where: { projectId: nodeId, assetId: { not: null } },
      select: { id: true, assetId: true },
    })
    const assetIds = dataReqs.map(r => r.assetId!).filter(Boolean)
    const [agents, assets] = await Promise.all([
      prisma.agent.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, name: true, status: true, department: true },
      }),
      prisma.dataAsset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, name: true, classification: true, ownerDept: true },
      }),
    ])
    const agentMap = new Map(agents.map(a => [a.id, a]))
    const assetMap = new Map(assets.map(a => [a.id, a]))

    for (const link of links) {
      const agent = agentMap.get(link.agentId)
      if (agent) {
        nodes.push({ id: agent.id, name: agent.name, status: agent.status, dept: agent.department, type: 'Agent' })
        edges.push({ id: link.id, from: agent.id, to: nodeId, label: 'BELONGS_TO' })
      }
    }
    for (const req of dataReqs) {
      const asset = assetMap.get(req.assetId!)
      if (asset) {
        nodes.push({ id: asset.id, name: asset.name, secretLevel: asset.classification, dept: asset.ownerDept, type: 'DataAsset' })
        edges.push({ id: `dr-${req.id}`, from: nodeId, to: asset.id, label: 'USES_DATA' })
      }
    }
  }

  if (nodeType === 'DataAsset') {
    const reqs = await prisma.dataRequest.findMany({
      where: { assetId: nodeId },
      select: { id: true, agentId: true, projectId: true },
    })
    const agentIds = reqs.map(r => r.agentId).filter(Boolean) as string[]
    const projectIds = reqs.map(r => r.projectId).filter(Boolean) as string[]
    const [agents, projects] = await Promise.all([
      prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, status: true, department: true } }),
      prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, title: true, status: true, department: true } }),
    ])
    const agentMap = new Map(agents.map(a => [a.id, a]))
    const projectMap = new Map(projects.map(p => [p.id, p]))

    for (const req of reqs) {
      if (req.agentId) {
        const agent = agentMap.get(req.agentId)
        if (agent) {
          nodes.push({ id: agent.id, name: agent.name, status: agent.status, dept: agent.department, type: 'Agent' })
          edges.push({ id: `dr-agent-${req.id}`, from: agent.id, to: nodeId, label: 'CONSUMES' })
        }
      }
      if (req.projectId) {
        const proj = projectMap.get(req.projectId)
        if (proj) {
          nodes.push({ id: proj.id, name: proj.title, status: proj.status, dept: proj.department, type: 'Project' })
          edges.push({ id: `dr-proj-${req.id}`, from: proj.id, to: nodeId, label: 'USES_DATA' })
        }
      }
    }
  }

  const uniqueNodes = Array.from(new Map(nodes.map(n => [(n as { id: string }).id, n])).values())
  return NextResponse.json({ nodes: uniqueNodes, edges })
}
