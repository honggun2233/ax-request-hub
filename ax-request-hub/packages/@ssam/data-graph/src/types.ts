export type NodeType = 'asset' | 'agent' | 'axproject' | 'project' | 'employee'
export type EdgeType = 'AGENT_DATA' | 'AGENT_AXPROJECT' | 'AGENT_PROJECT' | 'EMPLOYEE_AGENT' | 'ASSET_OWNER'
export type NodeKey = string  // 형식: "type:id"

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'

export interface GraphNode {
  key: NodeKey
  type: NodeType
  id: string
  label: string
  meta: Record<string, unknown>
}

export interface GraphEdge {
  from: NodeKey
  to: NodeKey
  type: EdgeType
}

export interface Graph {
  nodes: Map<NodeKey, GraphNode>
  edges: GraphEdge[]
}

export interface TraversalHit {
  node: GraphNode
  hops: number
  via: EdgeType[]
}

export interface ImpactedAgent {
  agentId: string
  agentName: string
  lifecycleStage: string
  status: string
  severity: Severity
  hops: number
}

export interface ImpactedProject {
  projectId: string
  projectName: string
  department: string
  hops: number
}

export interface ImpactedAsset {
  assetId: string
  assetName: string
  classification: string
  hops: number
}

export interface NotifyTarget {
  employeeId?: string
  name: string
  email?: string
  ownerDept?: string
  role: 'AGENT_MANAGER' | 'DATA_OWNER' | 'AGENT_OWNER_TEXT'
  resolved: boolean
}

export interface ImpactResult {
  origin: GraphNode
  severity: Severity
  agents: ImpactedAgent[]
  projects: ImpactedProject[]
  assets: ImpactedAsset[]
  notify: NotifyTarget[]
  dataQuality: {
    unresolvedOwners: number
    agentsWithoutManager: number
  }
  warnings: string[]
}
