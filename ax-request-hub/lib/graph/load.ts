import { prisma } from '@/lib/prisma'
import type { Graph, GraphNode, NodeKey } from './types'

function makeNode(
  type: GraphNode['type'],
  id: string,
  label: string,
  meta: Record<string, unknown>,
): GraphNode {
  return { key: `${type}:${id}` as NodeKey, type, id, label, meta }
}

export async function buildGraph(): Promise<Graph> {
  const [
    agents,
    assets,
    axprojects,
    projects,
    employees,
    agentDataLinks,
    agentProjectLinks,
    employeeAgentLinks,
  ] = await Promise.all([
    prisma.agentRegistry.findMany({
      select: { id: true, agentName: true, status: true, lifecycleStage: true, retiredAt: true, projectId: true },
    }),
    prisma.dataAsset.findMany({
      select: { id: true, name: true, classification: true, isActive: true, dataOwnerId: true, ownerDept: true },
    }),
    prisma.aXProject.findMany({
      select: { id: true, name: true, domain: true, status: true },
    }),
    prisma.project.findMany({
      select: { id: true, title: true, department: true, status: true },
    }),
    prisma.employee.findMany({
      select: { id: true, name: true, email: true, department: true, isActive: true },
    }),
    prisma.agentDataLink.findMany({ select: { agentId: true, dataAssetId: true } }),
    prisma.agentProjectLink.findMany({ select: { agentId: true, projectId: true } }),
    prisma.employeeAgentLink.findMany({ select: { employeeId: true, agentId: true } }),
  ])

  const nodes = new Map<NodeKey, GraphNode>()
  const edges: Graph['edges'] = []

  for (const a of agents) {
    const node = makeNode('agent', a.id, a.agentName, {
      status: a.status,
      lifecycleStage: a.lifecycleStage,
      retired: !!a.retiredAt,
    })
    nodes.set(node.key, node)
  }

  for (const a of assets) {
    const node = makeNode('asset', a.id, a.name, {
      classification: a.classification,
      isActive: a.isActive,
      dataOwnerId: a.dataOwnerId,
      ownerDept: a.ownerDept,
    })
    nodes.set(node.key, node)
  }

  for (const p of axprojects) {
    const node = makeNode('axproject', p.id, p.name, {
      domain: p.domain,
      status: p.status,
    })
    nodes.set(node.key, node)
  }

  for (const p of projects) {
    const node = makeNode('project', p.id, p.title, {
      department: p.department,
      status: p.status,
    })
    nodes.set(node.key, node)
  }

  for (const e of employees) {
    const node = makeNode('employee', e.id, e.name, {
      department: e.department,
      isActive: e.isActive,
    })
    nodes.set(node.key, node)
  }

  for (const link of agentDataLinks) {
    edges.push({ from: `agent:${link.agentId}`, to: `asset:${link.dataAssetId}`, type: 'AGENT_DATA' })
  }

  for (const link of agentProjectLinks) {
    edges.push({ from: `agent:${link.agentId}`, to: `axproject:${link.projectId}`, type: 'AGENT_AXPROJECT' })
  }

  for (const link of employeeAgentLinks) {
    edges.push({ from: `employee:${link.employeeId}`, to: `agent:${link.agentId}`, type: 'EMPLOYEE_AGENT' })
  }

  for (const a of agents) {
    if (a.projectId != null) {
      edges.push({ from: `agent:${a.id}`, to: `project:${a.projectId}`, type: 'AGENT_PROJECT' })
    }
  }

  for (const a of assets) {
    if (a.dataOwnerId != null) {
      edges.push({ from: `asset:${a.id}`, to: `employee:${a.dataOwnerId}`, type: 'ASSET_OWNER' })
    }
  }

  return { nodes, edges }
}
