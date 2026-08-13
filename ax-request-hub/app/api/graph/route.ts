import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'

export async function GET(req: Request) {
  const auth = await requireRole()
  if ('error' in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'overview'
  const nodeId = searchParams.get('nodeId')
  const nodeType = searchParams.get('type')

  if (mode === 'overview') {
    const [projects, agents, dataAssets] = await Promise.all([
      prisma.project.count(),
      prisma.agent.count(),
      prisma.dataAsset.count(),
    ])

    const dataRequests = await prisma.dataRequest.count({
      where: { assetId: { not: null } },
    })

    return NextResponse.json({
      nodes: { Project: projects, Agent: agents, DataAsset: dataAssets },
      edges: { USES_DATA: dataRequests },
    })
  }

  if (mode === 'nodes') {
    if (nodeType === 'Project' || !nodeType) {
      const projects = await prisma.project.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          confidentialityLevel: true,
          department: true,
          requesterName: true,
        },
        take: 100,
      })
      const nodes = projects.map((p) => ({
        id: `project-${p.id}`,
        type: 'Project',
        label: p.title,
        data: p,
      }))
      if (nodeType === 'Project') return NextResponse.json({ nodes })
      const agentNodes = await getAgentNodes()
      const dataNodes = await getDataAssetNodes()
      return NextResponse.json({ nodes: [...nodes, ...agentNodes, ...dataNodes] })
    }
    if (nodeType === 'Agent') {
      return NextResponse.json({ nodes: await getAgentNodes() })
    }
    if (nodeType === 'DataAsset') {
      return NextResponse.json({ nodes: await getDataAssetNodes() })
    }
  }

  if (mode === 'explore' && nodeId) {
    return NextResponse.json(await exploreNode(nodeId))
  }

  if (mode === 'full') {
    return NextResponse.json(await getFullGraph())
  }

  return NextResponse.json({ error: 'invalid mode' }, { status: 400 })
}

async function getAgentNodes() {
  const agents = await prisma.agent.findMany({
    select: { id: true, name: true, status: true, department: true },
    take: 100,
  })
  return agents.map((a) => ({
    id: `agent-${a.id}`,
    type: 'Agent',
    label: a.name,
    data: a,
  }))
}

async function getDataAssetNodes() {
  const assets = await prisma.dataAsset.findMany({
    select: { id: true, name: true, classification: true, ownerDept: true },
    take: 100,
  })
  return assets.map((d) => ({
    id: `data-${d.id}`,
    type: 'DataAsset',
    label: d.name,
    data: d,
  }))
}

async function getFullGraph() {
  const [projects, agents, dataAssets, dataRequests, agentProjectLinks] =
    await Promise.all([
      prisma.project.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          confidentialityLevel: true,
          department: true,
          requesterName: true,
        },
      }),
      prisma.agent.findMany({
        select: { id: true, name: true, status: true, department: true },
      }),
      prisma.dataAsset.findMany({
        select: { id: true, name: true, classification: true, ownerDept: true },
      }),
      prisma.dataRequest.findMany({
        where: { assetId: { not: null } },
        select: {
          id: true,
          projectId: true,
          agentId: true,
          assetId: true,
          status: true,
          type: true,
        },
      }),
      prisma.agentProjectLink.findMany({
        select: { agentId: true, projectId: true },
      }),
    ])

  const nodes = [
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      type: 'Project',
      label: p.title,
      data: p,
    })),
    ...agents.map((a) => ({
      id: `agent-${a.id}`,
      type: 'Agent',
      label: a.name,
      data: a,
    })),
    ...dataAssets.map((d) => ({
      id: `data-${d.id}`,
      type: 'DataAsset',
      label: d.name,
      data: d,
    })),
  ]

  const edges: { id: string; source: string; target: string; label: string }[] = []

  for (const req of dataRequests) {
    if (req.projectId && req.assetId) {
      edges.push({
        id: `e-proj-data-${req.id}`,
        source: `project-${req.projectId}`,
        target: `data-${req.assetId}`,
        label: 'USES_DATA',
      })
    }
    if (req.agentId && req.assetId) {
      edges.push({
        id: `e-agent-data-${req.id}`,
        source: `agent-${req.agentId}`,
        target: `data-${req.assetId}`,
        label: 'CONSUMES',
      })
    }
  }

  for (const link of agentProjectLinks) {
    edges.push({
      id: `e-agent-proj-${link.agentId}-${link.projectId}`,
      source: `agent-${link.agentId}`,
      target: `project-${link.projectId}`,
      label: 'BELONGS_TO',
    })
  }

  return { nodes, edges }
}

async function exploreNode(nodeId: string) {
  const [prefix, id] = [nodeId.split('-')[0], nodeId.split('-').slice(1).join('-')]

  if (prefix === 'project') {
    const reqs = await prisma.dataRequest.findMany({
      where: { projectId: id, assetId: { not: null } },
      include: { asset: true },
    })
    const links = await prisma.agentProjectLink.findMany({
      where: { projectId: id },
    })
    const nodes: object[] = []
    const edges: object[] = []

    for (const req of reqs) {
      if (req.asset) {
        nodes.push({ id: `data-${req.asset.id}`, type: 'DataAsset', label: req.asset.name, data: req.asset })
        edges.push({ id: `e-${req.id}`, source: `project-${id}`, target: `data-${req.asset.id}`, label: 'USES_DATA' })
      }
    }
    for (const link of links) {
      const agent = await prisma.agent.findFirst({ where: { id: link.agentId } })
      if (agent) {
        nodes.push({ id: `agent-${agent.id}`, type: 'Agent', label: agent.name, data: agent })
        edges.push({ id: `e-apl-${link.agentId}`, source: `agent-${agent.id}`, target: `project-${id}`, label: 'BELONGS_TO' })
      }
    }
    return { nodes, edges }
  }

  return { nodes: [], edges: [] }
}
