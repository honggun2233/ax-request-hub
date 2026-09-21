import type { EdgeType } from './types'

export interface ScenarioConfig {
  allowedEdges: EdgeType[]
  defaultHops: number
}

export const SCENARIOS: Record<string, ScenarioConfig> = {
  asset: {
    allowedEdges: ['AGENT_DATA', 'AGENT_AXPROJECT', 'AGENT_PROJECT', 'EMPLOYEE_AGENT', 'ASSET_OWNER'],
    defaultHops: 3,
  },
  agent: {
    allowedEdges: ['AGENT_AXPROJECT', 'AGENT_PROJECT', 'EMPLOYEE_AGENT'],
    defaultHops: 2,
  },
  employee: {
    allowedEdges: ['EMPLOYEE_AGENT', 'AGENT_AXPROJECT', 'AGENT_PROJECT'],
    defaultHops: 3,
  },
}
