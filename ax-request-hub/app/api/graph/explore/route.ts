import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type NodeType = 'Agent' | 'Project' | 'DataAsset' | 'Employee'

interface GraphNode {
  id: string
  type: NodeType
  name: string
  [key: string]: unknown
}

interface GraphEdge {
  id: string
  from: string
  to: string
  label: string
}

async function getNodeInfo(id: string, type: NodeType): Promise<GraphNode | null> {
  if (type === 'Agent') {
    const a = await db.agentRegistry.findUnique({
      where: { id },
      select: { id: true, agentName: true, lifecycleStage: true, trustScore: true },
    })
    if (!a) return null
    return { id: a.id, type: 'Agent', name: a.agentName, lifecycleStage: a.lifecycleStage, trustScore: a.trustScore }
  }
  if (type === 'Project') {
    const p = await db.aXProject.findUnique({
      where: { id },
      select: { id: true, name: true, status: true },
    })
    if (!p) return null
    return { id: p.id, type: 'Project', name: p.name, status: p.status }
  }
  if (type === 'DataAsset') {
    const d = await db.dataAsset.findUnique({
      where: { id },
      select: { id: true, name: true, classification: true, ownerDept: true },
    })
    if (!d) return null
    return { id: d.id, type: 'DataAsset', name: d.name, secretLevel: d.classification, owner: d.ownerDept }
  }
  if (type === 'Employee') {
    const e = await db.employee.findUnique({
      where: { id },
      select: { id: true, name: true, department: true, currentLevel: true },
    })
    if (!e) return null
    return { id: e.id, type: 'Employee', name: e.name, dept: e.department, literacyLevel: e.currentLevel }
  }
  return null
}

async function getEdgesFrom(id: string, type: NodeType): Promise<{ edges: GraphEdge[]; neighbors: { id: string; type: NodeType }[] }> {
  const edges: GraphEdge[] = []
  const neighbors: { id: string; type: NodeType }[] = []

  if (type === 'Agent') {
    const [projectLinks, dataLinks] = await Promise.all([
      db.agentProjectLink.findMany({ where: { agentId: id }, select: { id: true, agentId: true, projectId: true } }),
      db.agentDataLink.findMany({ where: { agentId: id }, select: { id: true, agentId: true, dataAssetId: true } }),
    ])
    for (const l of projectLinks) {
      edges.push({ id: l.id, from: l.agentId, to: l.projectId, label: 'BELONGS_TO' })
      neighbors.push({ id: l.projectId, type: 'Project' })
    }
    for (const l of dataLinks) {
      edges.push({ id: l.id, from: l.agentId, to: l.dataAssetId, label: 'CONSUMES' })
      neighbors.push({ id: l.dataAssetId, type: 'DataAsset' })
    }
    // also get incoming MANAGES edges
    const empLinks = await db.employeeAgentLink.findMany({ where: { agentId: id }, select: { id: true, employeeId: true, agentId: true } })
    for (const l of empLinks) {
      edges.push({ id: l.id, from: l.employeeId, to: l.agentId, label: 'MANAGES' })
      neighbors.push({ id: l.employeeId, type: 'Employee' })
    }
  }

  if (type === 'Project') {
    const links = await db.agentProjectLink.findMany({ where: { projectId: id }, select: { id: true, agentId: true, projectId: true } })
    for (const l of links) {
      edges.push({ id: l.id, from: l.agentId, to: l.projectId, label: 'BELONGS_TO' })
      neighbors.push({ id: l.agentId, type: 'Agent' })
    }
  }

  if (type === 'DataAsset') {
    const links = await db.agentDataLink.findMany({ where: { dataAssetId: id }, select: { id: true, agentId: true, dataAssetId: true } })
    for (const l of links) {
      edges.push({ id: l.id, from: l.agentId, to: l.dataAssetId, label: 'CONSUMES' })
      neighbors.push({ id: l.agentId, type: 'Agent' })
    }
  }

  if (type === 'Employee') {
    const links = await db.employeeAgentLink.findMany({ where: { employeeId: id }, select: { id: true, employeeId: true, agentId: true } })
    for (const l of links) {
      edges.push({ id: l.id, from: l.employeeId, to: l.agentId, label: 'MANAGES' })
      neighbors.push({ id: l.agentId, type: 'Agent' })
    }
  }

  return { edges, neighbors }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const nodeId = searchParams.get('nodeId')
  const nodeType = searchParams.get('nodeType') as NodeType | null
  const depthParam = parseInt(searchParams.get('depth') ?? '1', 10)
  const depth = Math.min(Math.max(depthParam, 1), 2)

  if (!nodeId || !nodeType) {
    return NextResponse.json({ error: 'nodeId and nodeType are required' }, { status: 400 })
  }

  const center = await getNodeInfo(nodeId, nodeType)
  if (!center) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  }

  const nodesMap = new Map<string, GraphNode>()
  const edgesMap = new Map<string, GraphEdge>()

  const { edges: d1Edges, neighbors: d1Neighbors } = await getEdgesFrom(nodeId, nodeType)
  for (const e of d1Edges) edgesMap.set(e.id, e)

  const d1NodeInfos = await Promise.all(d1Neighbors.map((n) => getNodeInfo(n.id, n.type)))
  for (const n of d1NodeInfos) {
    if (n) nodesMap.set(n.id, n)
  }

  if (depth === 2) {
    const d2Fetches = d1Neighbors.map((n) => getEdgesFrom(n.id, n.type))
    const d2Results = await Promise.all(d2Fetches)

    const d2Neighbors: { id: string; type: NodeType }[] = []
    for (const { edges, neighbors } of d2Results) {
      for (const e of edges) edgesMap.set(e.id, e)
      d2Neighbors.push(...neighbors)
    }

    const d2NodeInfos = await Promise.all(
      d2Neighbors.filter((n) => n.id !== nodeId && !nodesMap.has(n.id)).map((n) => getNodeInfo(n.id, n.type))
    )
    for (const n of d2NodeInfos) {
      if (n) nodesMap.set(n.id, n)
    }
  }

  return NextResponse.json({
    center,
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
  })
}
