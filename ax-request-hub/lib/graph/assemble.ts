import type {
  GraphNode,
  TraversalHit,
  ImpactResult,
  ImpactedAgent,
  ImpactedProject,
  ImpactedAsset,
  NotifyTarget,
  Severity,
} from './types'

export function severityOf(node: GraphNode): Severity {
  const status = node.meta.status
  const stage = node.meta.lifecycleStage
  if (status === 'ACTIVE' || status === 'DEGRADED') return 'HIGH'
  if (stage === 'GATE3' || stage === 'GATE2') return 'MEDIUM'
  return 'LOW'
}

const SEVERITY_ORDER: Record<Severity, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 }

function maxSeverity(severities: Severity[]): Severity {
  if (severities.length === 0) return 'LOW'
  return severities.reduce((a, b) =>
    SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b
  )
}

export function assembleResult(
  origin: GraphNode,
  hits: TraversalHit[],
  userRole: string
): ImpactResult {
  // Agents
  const agents: ImpactedAgent[] = hits
    .filter(h => h.node.type === 'agent')
    .map(h => ({
      agentId: h.node.id,
      agentName: h.node.label,
      lifecycleStage: String(h.node.meta.lifecycleStage ?? ''),
      status: String(h.node.meta.status ?? ''),
      severity: severityOf(h.node),
      hops: h.hops,
    }))

  // Projects (project + axproject)
  const projects: ImpactedProject[] = hits
    .filter(h => h.node.type === 'project' || h.node.type === 'axproject')
    .map(h => ({
      projectId: h.node.id,
      projectName: h.node.label,
      department: String(h.node.meta.department ?? h.node.meta.domain ?? ''),
      hops: h.hops,
    }))

  // Assets
  const assets: ImpactedAsset[] = hits
    .filter(h => h.node.type === 'asset')
    .map(h => ({
      assetId: h.node.id,
      assetName: h.node.label,
      classification: String(h.node.meta.classification ?? ''),
      hops: h.hops,
    }))

  // Overall severity
  let severity: Severity
  if (origin.type === 'agent') {
    severity = severityOf(origin)
  } else {
    severity = maxSeverity(agents.map(a => a.severity))
  }

  // Notify targets
  const notifyMap = new Map<string, NotifyTarget>()
  const notifyUnkeyed: NotifyTarget[] = []

  function upsert(entry: NotifyTarget) {
    if (entry.employeeId) {
      const existing = notifyMap.get(entry.employeeId)
      if (!existing || (!existing.resolved && entry.resolved)) {
        notifyMap.set(entry.employeeId, entry)
      }
    } else {
      notifyUnkeyed.push(entry)
    }
  }

  // a) AGENT_MANAGER: employee hits reached via EMPLOYEE_AGENT edge
  for (const h of hits) {
    if (h.node.type === 'employee' && h.via.includes('EMPLOYEE_AGENT')) {
      upsert({
        employeeId: h.node.id,
        name: h.node.label,
        email: h.node.meta.email ? String(h.node.meta.email) : undefined,
        role: 'AGENT_MANAGER',
        resolved: true,
      })
    }
  }

  // Build employee-hit lookup for DATA_OWNER resolution
  const employeeById = new Map<string, GraphNode>()
  for (const h of hits) {
    if (h.node.type === 'employee') {
      employeeById.set(h.node.id, h.node)
    }
  }

  // b) DATA_OWNER: from asset hits
  for (const h of hits) {
    if (h.node.type !== 'asset') continue
    const dataOwnerId = h.node.meta.dataOwnerId
    if (!dataOwnerId) continue
    const ownerId = String(dataOwnerId)
    const empNode = employeeById.get(ownerId)
    if (empNode) {
      upsert({
        employeeId: ownerId,
        name: empNode.label,
        email: empNode.meta.email ? String(empNode.meta.email) : undefined,
        role: 'DATA_OWNER',
        resolved: true,
      })
    } else {
      upsert({
        employeeId: ownerId,
        name: '',
        role: 'DATA_OWNER',
        resolved: false,
      })
    }
  }

  // c) AGENT_OWNER_TEXT: meta.owner on agent hits
  for (const h of hits) {
    if (h.node.type !== 'agent') continue
    const owner = h.node.meta.owner
    if (!owner) continue
    const ownerName = String(owner)
    // Skip if already in notify as an employeeId match (can't match — no employeeId here)
    notifyUnkeyed.push({
      name: ownerName,
      role: 'AGENT_OWNER_TEXT',
      resolved: false,
    })
  }

  const notify: NotifyTarget[] = [...notifyMap.values(), ...notifyUnkeyed]

  // dataQuality
  const hasManager = notify.some(n => n.role === 'AGENT_MANAGER')
  const dataQuality = {
    unresolvedOwners: notify.filter(n => !n.resolved).length,
    agentsWithoutManager: hasManager ? 0 : agents.length,
  }

  // warnings
  const warnings: string[] = []
  const hasG3 = assets.some(a => a.classification === 'G3')
  if (hasG3) {
    if (userRole === 'AX_TEAM' || userRole === 'DATA_PLATFORM') {
      warnings.push('G3 데이터 자산 접근 에이전트 존재: 보안 검토 필요')
    } else if (userRole === 'C_LEVEL' || userRole === 'EXECUTIVE') {
      warnings.push('기밀 G3 자산 접근 에이전트 존재')
    }
  }

  return { origin, severity, agents, projects, assets, notify, dataQuality, warnings }
}
