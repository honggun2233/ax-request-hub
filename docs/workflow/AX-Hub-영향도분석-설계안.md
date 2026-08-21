# AX Hub 영향도 분석(Impact Analysis) 설계안 — Phase 1

**대상 시스템**: 삼성자산운용 AX Request Hub
**작성일**: 2026-08-11
**범위**: 지식 그래프 Phase ① 링크 테이블을 활용한 영향도 질의 API 및 UI 연결
**전제**: 신규 스키마 변경 없이 현재 데이터만으로 구현 (Phase 2에서 최소 변경 1건 제안)

---

## 1. 배경과 목표

### 1.1 문제 정의

현재 `/graph`는 전체 그래프를 렌더링하지만, 엣지가 전부 **에이전트 중심 1-hop** 구조라 에이전트 상세 화면의 표가 보여주는 정보 이상을 제공하지 못합니다. 노드 규모(에이전트 19개)에서는 force-directed 레이아웃으로 구조가 창발하지도 않습니다.

### 1.2 방향 전환

**"둘러보는 그래프"에서 "질문에 답하는 그래프"로.**

그래프 순회 로직은 구축하되, **기본 출력은 시각화가 아니라 구조화된 목록**으로 합니다. 시각화는 선택적 보조 뷰로 남깁니다.

### 1.3 Phase 1 목표

> **3가지 영향도 질의를 정확히 답하는 API 1개와, 그것을 소비하는 UI 연결 지점 3곳.**

| 시나리오 | 질문 | 실무 소비처 |
|---|---|---|
| `dataAsset` | 이 데이터 접근을 회수하면 무엇이 멈추고 누구에게 통보하나? | 데이터플랫폼팀 접근권한 만료 처리 |
| `agent` | 이 에이전트를 폐기하면 어떤 과제가 고아가 되나? | 폐기 거버넌스 (`/admin/retired`) |
| `employee` | 이 사람이 퇴사/이동하면 담당 공백이 생기는 곳은? | 인사 변동 시 AX팀 인수인계 |

### 1.4 비목표 (Phase 1에서 하지 않는 것)

- 그래프 시각화 개선 — Phase 1은 API와 목록 출력까지
- 시간축 / 이력 조회 — `AuditLog` 기록이 선행되어야 함 (Phase 3)
- 중복투자 탐지, 키맨 리스크 대시보드 — Phase 2
- 그래프 DB 도입 — 현재 규모에서 불필요 (7장 참조)

---

## 2. 그래프 모델

### 2.1 현재 스키마에서 도출 가능한 노드·엣지

**노드 5종**

| 타입 | 소스 모델 | 식별자 | 표시명 |
|---|---|---|---|
| `asset` | `DataAsset` | `id` | `name` |
| `agent` | `AgentRegistry` | `id` | `agentName` |
| `axproject` | `AXProject` | `id` | `name` |
| `project` | `Project` | `id` | `title` |
| `employee` | `Employee` | `id` | `name` |

**엣지 5종**

| 타입 | 소스 | 연결 | 비고 |
|---|---|---|---|
| `AGENT_DATA` | `AgentDataLink` | `agent` ↔ `asset` | `accessLevel`, `purpose` 보유 |
| `AGENT_AXPROJECT` | `AgentProjectLink` | `agent` ↔ `axproject` | `role` 보유 |
| `AGENT_PROJECT` | `AgentRegistry.projectId` | `agent` ↔ `project` | FK, nullable |
| `EMPLOYEE_AGENT` | `EmployeeAgentLink` | `employee` ↔ `agent` | `role` 보유 |
| `ASSET_OWNER` | `DataAsset.dataOwnerId` | `asset` ↔ `employee` | 데이터 오너 |

### 2.2 설계 결정 ①: 이중 프로젝트 모델 처리

`AgentRegistry`는 **두 개의 서로 다른 프로젝트 개념**에 연결됩니다.

```
AgentRegistry ─ AgentProjectLink (M:N) → AXProject   ← /api/ax-projects, /api/registry/links
AgentRegistry ─ projectId (1:N FK)     → Project     ← /api/projects, 등록 모달
```

이는 1차 리뷰에서 지적한 구조적 부채이며, **영향도 분석에서 가장 직접적으로 문제가 됩니다.** 한쪽만 순회하면 영향 범위가 누락되기 때문입니다.

**Phase 1 처리 방침**: 두 엣지를 **모두 순회**하고, 응답에서 타입을 구분해 반환합니다. 통합 전까지는 이 방식이 유일하게 안전합니다.

```jsonc
"impacted": {
  "axprojects": [ ... ],   // AgentProjectLink 경유
  "projects":   [ ... ]    // AgentRegistry.projectId 경유
}
```

> **후속 조치**: 두 모델 통합 시 이 분기를 제거할 수 있습니다. 영향도 API가 통합의 실익을 정량적으로 보여주는 근거가 되므로, 통합 논의 시 이 코드를 근거 자료로 사용하세요.

### 2.3 설계 결정 ②: 통보 대상(notify) 산출

담당자 정보가 3곳에 분산돼 있습니다.

| 출처 | 형태 | 신뢰도 |
|---|---|---|
| `EmployeeAgentLink.employeeId` | FK → Employee | 높음 (정식 링크) |
| `AgentRegistry.owner` | String, `@default("CTO")` | 낮음 (자유 텍스트, 기본값 오염) |
| `DataAsset.dataOwnerId` | FK → Employee | 높음 |

**방침**: `EmployeeAgentLink`와 `DataAsset.dataOwnerId`를 1차 소스로 사용하고, `AgentRegistry.owner`는 **매칭 실패 시 보조 표시용 문자열**로만 노출합니다(자동 통보 대상에서 제외).

```jsonc
"notify": [
  { "employeeId": "...", "name": "홍길동", "email": "...", "reason": "AGENT_MANAGER", "resolved": true },
  { "name": "CTO", "reason": "AGENT_OWNER_TEXT", "resolved": false }  // 이메일 없음 — 수동 확인 필요
]
```

`resolved: false` 항목이 많다면 `EmployeeAgentLink` 데이터가 부실하다는 신호이므로, 응답에 `dataQuality` 지표를 함께 담아 관리자가 인지하게 합니다.

---

## 3. API 설계

### 3.1 엔드포인트

```
GET /api/graph/impact?type={asset|agent|employee}&id={id}&hops={1..4}
```

| 파라미터 | 필수 | 기본값 | 설명 |
|---|:-:|---|---|
| `type` | ✅ | — | 시작 노드 타입. 위 3종만 허용 |
| `id` | ✅ | — | 시작 노드 ID |
| `hops` | | `3` | 최대 탐색 깊이 (1~4) |
| `includeRetired` | | `false` | 폐기된 에이전트 포함 여부 |

### 3.2 권한

```ts
const auth = await requireRole('AX_TEAM', 'DATA_PLATFORM', 'C_LEVEL', 'EXECUTIVE')
if ('error' in auth) return auth.error
```

**이 API는 조직의 AI 의존 구조 전체를 노출합니다.** 어떤 부서가 어떤 G3 데이터를 쓰는지, 누가 무엇을 담당하는지가 한 번의 호출로 드러나므로, 다른 조회 API보다 엄격하게 제한합니다.

- 반드시 `lib/authz.ts`의 `requireRole()`을 사용할 것 (`getServerSession` 직접 호출 금지 — 권한 회수 반영 지연 문제)
- `DATA_PLATFORM`은 `asset` 시나리오만 허용하는 것도 검토 가능 (Phase 1은 3종 모두 허용하되, 접근 로그를 남길 것)

### 3.3 G3 데이터 마스킹

응답에 `classification: 'G3'` 자산이 포함될 경우, 요청자 역할에 따라 필드를 축소합니다.

| 역할 | G3 자산 표시 |
|---|---|
| `AX_TEAM`, `DATA_PLATFORM` | 전체 (`name`, `description`, `ownerDept`) |
| `C_LEVEL`, `EXECUTIVE` | `name`, `ownerDept`만 |
| 그 외 | 호출 자체가 403 |

### 3.4 감사 로그

**영향도 조회는 그 자체가 감사 대상 행위입니다.** 호출 시 `AuditLog`에 기록합니다.

```ts
await prisma.auditLog.create({ data: {
  entityType: 'Graph', entityId: `${type}:${id}`, action: 'IMPACT_QUERY',
  actorEmail: auth.user.email,
  detail: JSON.stringify({ hops, resultCount: result.summary.totalImpacted }),
}})
```

> `AuditLog` 모델은 존재하나 현재 코드베이스 전체에서 쓰기 호출이 0건입니다(1·2차 리뷰 지적). 이 API를 첫 번째 기록 지점으로 삼으면, 감사 로그 인프라를 실제로 작동시키는 계기가 됩니다.

---

## 4. 타입 정의

```ts
// lib/graph/types.ts

export type NodeType = 'asset' | 'agent' | 'axproject' | 'project' | 'employee'

export type EdgeType =
  | 'AGENT_DATA'        // agent ↔ asset
  | 'AGENT_AXPROJECT'   // agent ↔ axproject
  | 'AGENT_PROJECT'     // agent ↔ project
  | 'EMPLOYEE_AGENT'    // employee ↔ agent
  | 'ASSET_OWNER'       // asset ↔ employee

/** "agent:clx123" 형태의 전역 고유 노드 키 */
export type NodeKey = string

export interface GraphNode {
  key: NodeKey
  type: NodeType
  id: string
  label: string
  meta: Record<string, unknown>   // lifecycleStage, classification, department 등
}

export interface GraphEdge {
  type: EdgeType
  from: NodeKey
  to: NodeKey
  meta?: Record<string, unknown>  // accessLevel, role 등
}

export interface Graph {
  nodes: Map<NodeKey, GraphNode>
  adjacency: Map<NodeKey, GraphEdge[]>
  builtAt: number
}

export interface TraversalHit {
  node: GraphNode
  distance: number
  path: GraphEdge[]              // 시작점부터의 경로 — 근거 제시에 사용
}

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ImpactResult {
  origin: GraphNode
  summary: {
    totalImpacted: number
    highSeverityCount: number
    byType: Record<NodeType, number>
  }
  impacted: {
    agents: ImpactedAgent[]
    axprojects: ImpactedProject[]
    projects: ImpactedProject[]
    assets: ImpactedAsset[]
  }
  notify: NotifyTarget[]
  dataQuality: {
    unresolvedOwners: number     // 이메일 매칭 실패한 담당자 수
    agentsWithoutManager: number // EmployeeAgentLink가 없는 에이전트 수
  }
  warnings: string[]             // 예: "G3 자산 2건이 마스킹되었습니다."
}

export interface ImpactedAgent {
  id: string
  agentName: string
  lifecycleStage: string
  severity: Severity
  distance: number
  reason: string                 // "KRX 시세 API를 직접 참조"
}

export interface ImpactedProject {
  id: string
  name: string
  linkKind: 'AXProject' | 'Project'
  viaAgents: string[]            // 영향 경로상의 에이전트명
}

export interface ImpactedAsset {
  id: string
  name: string
  classification: string
  masked: boolean
}

export interface NotifyTarget {
  employeeId?: string
  name: string
  email?: string
  department?: string
  reason: 'AGENT_MANAGER' | 'DATA_OWNER' | 'AGENT_OWNER_TEXT'
  resolved: boolean
}
```

---

## 5. 그래프 적재 및 순회 구현

### 5.1 적재 (`lib/graph/load.ts`)

전체 링크 테이블을 한 번에 읽어 인메모리 그래프를 구성합니다. 현재 규모에서 총 레코드 수는 수백 건 수준이므로 부담이 없습니다.

```ts
import { prisma } from '@/lib/prisma'
import type { Graph, GraphNode, GraphEdge, NodeKey } from './types'

const key = (type: string, id: string): NodeKey => `${type}:${id}`

export async function buildGraph(): Promise<Graph> {
  const [agents, assets, axprojects, projects, employees,
         dataLinks, projectLinks, employeeLinks] = await Promise.all([
    prisma.agentRegistry.findMany({
      select: { id: true, agentName: true, lifecycleStage: true, owner: true,
                projectId: true, retiredAt: true, fallbackRate: true },
    }),
    prisma.dataAsset.findMany({
      select: { id: true, name: true, classification: true, ownerDept: true,
                dataOwnerId: true, isActive: true },
    }),
    prisma.aXProject.findMany({ select: { id: true, name: true, domain: true, status: true } }),
    prisma.project.findMany({ select: { id: true, title: true, department: true, status: true } }),
    prisma.employee.findMany({
      select: { id: true, name: true, email: true, department: true, isActive: true },
    }),
    prisma.agentDataLink.findMany(),
    prisma.agentProjectLink.findMany(),
    prisma.employeeAgentLink.findMany(),
  ])

  const nodes = new Map<NodeKey, GraphNode>()
  const adjacency = new Map<NodeKey, GraphEdge[]>()

  const addNode = (type: string, id: string, label: string, meta: Record<string, unknown>) => {
    const k = key(type, id)
    nodes.set(k, { key: k, type: type as any, id, label, meta })
    if (!adjacency.has(k)) adjacency.set(k, [])
  }

  /** 무방향 그래프 — 양방향 엣지로 저장 */
  const addEdge = (type: GraphEdge['type'], a: NodeKey, b: NodeKey, meta?: Record<string, unknown>) => {
    if (!nodes.has(a) || !nodes.has(b)) return       // 고아 링크 방어
    adjacency.get(a)!.push({ type, from: a, to: b, meta })
    adjacency.get(b)!.push({ type, from: b, to: a, meta })
  }

  agents.forEach(a => addNode('agent', a.id, a.agentName, {
    lifecycleStage: a.lifecycleStage, owner: a.owner,
    retired: !!a.retiredAt, fallbackRate: a.fallbackRate,
  }))
  assets.forEach(a => addNode('asset', a.id, a.name, {
    classification: a.classification, ownerDept: a.ownerDept, isActive: a.isActive,
  }))
  axprojects.forEach(p => addNode('axproject', p.id, p.name, { domain: p.domain, status: p.status }))
  projects.forEach(p => addNode('project', p.id, p.title, { department: p.department, status: p.status }))
  employees.forEach(e => addNode('employee', e.id, e.name, {
    email: e.email, department: e.department, isActive: e.isActive,
  }))

  dataLinks.forEach(l => addEdge('AGENT_DATA',
    key('agent', l.agentId), key('asset', l.dataAssetId),
    { accessLevel: l.accessLevel, purpose: l.purpose }))

  projectLinks.forEach(l => addEdge('AGENT_AXPROJECT',
    key('agent', l.agentId), key('axproject', l.projectId), { role: l.role }))

  employeeLinks.forEach(l => addEdge('EMPLOYEE_AGENT',
    key('employee', l.employeeId), key('agent', l.agentId), { role: l.role }))

  // 설계 결정 ① — Project(구 모델) 엣지도 함께 구성
  agents.filter(a => a.projectId).forEach(a =>
    addEdge('AGENT_PROJECT', key('agent', a.id), key('project', a.projectId!)))

  // 설계 결정 ② — 데이터 오너
  assets.filter(a => a.dataOwnerId).forEach(a =>
    addEdge('ASSET_OWNER', key('asset', a.id), key('employee', a.dataOwnerId!)))

  return { nodes, adjacency, builtAt: Date.now() }
}
```

### 5.2 캐싱

```ts
// lib/graph/cache.ts
let cached: Graph | null = null
const TTL_MS = 60_000

export async function getGraph(force = false): Promise<Graph> {
  if (!force && cached && Date.now() - cached.builtAt < TTL_MS) return cached
  cached = await buildGraph()
  return cached
}

/** 링크 변경 API(POST/DELETE /api/registry/links 등)에서 호출 */
export function invalidateGraph() { cached = null }
```

> **주의**: 이 캐시는 프로세스 로컬입니다. `output: 'standalone'`으로 다중 인스턴스 배포 시 인스턴스마다 최대 60초 편차가 발생합니다. Phase 1(단일 인스턴스)에서는 무해하나, 스케일아웃 시 TTL을 짧게 하거나 Redis로 이전해야 합니다.

### 5.3 BFS 순회 (`lib/graph/traverse.ts`)

무방향 그래프에서 시작 노드로부터 BFS를 수행하되, **시나리오별로 따라갈 엣지 타입을 제한**합니다. 이것이 "영향도"의 방향성을 표현하는 방법입니다.

```ts
import type { Graph, NodeKey, GraphEdge, TraversalHit, EdgeType } from './types'

interface TraverseOptions {
  maxHops: number
  allowedEdges: EdgeType[]
  /** false면 retired 에이전트에서 탐색을 중단 */
  includeRetired?: boolean
}

export function traverse(graph: Graph, start: NodeKey, opts: TraverseOptions): TraversalHit[] {
  const startNode = graph.nodes.get(start)
  if (!startNode) return []

  const visited = new Set<NodeKey>([start])
  const results: TraversalHit[] = []
  let frontier: Array<{ key: NodeKey; path: GraphEdge[] }> = [{ key: start, path: [] }]

  for (let depth = 1; depth <= opts.maxHops && frontier.length > 0; depth++) {
    const next: typeof frontier = []

    for (const { key: cur, path } of frontier) {
      for (const edge of graph.adjacency.get(cur) ?? []) {
        if (!opts.allowedEdges.includes(edge.type)) continue
        if (visited.has(edge.to)) continue

        const node = graph.nodes.get(edge.to)!

        // 폐기된 에이전트는 결과에 포함하되 더 이상 전파하지 않음
        const isRetiredAgent = node.type === 'agent' && node.meta.retired === true
        if (isRetiredAgent && !opts.includeRetired) continue

        visited.add(edge.to)
        const newPath = [...path, edge]
        results.push({ node, distance: depth, path: newPath })

        if (!isRetiredAgent) next.push({ key: edge.to, path: newPath })
      }
    }
    frontier = next
  }

  return results
}
```

**복잡도**: O(V + E). 현재 규모(노드 수백, 엣지 수백)에서 실행 시간은 1ms 미만입니다.

### 5.4 시나리오별 순회 정책

```ts
// lib/graph/scenarios.ts
export const SCENARIOS = {
  asset: {
    // 데이터 회수 → 에이전트 → 과제 → 담당자
    allowedEdges: ['AGENT_DATA', 'AGENT_AXPROJECT', 'AGENT_PROJECT',
                   'EMPLOYEE_AGENT', 'ASSET_OWNER'] as EdgeType[],
    defaultHops: 3,
  },
  agent: {
    // 에이전트 폐기 → 과제 고아화 + 담당자 통보 (데이터는 역방향이므로 제외)
    allowedEdges: ['AGENT_AXPROJECT', 'AGENT_PROJECT', 'EMPLOYEE_AGENT'] as EdgeType[],
    defaultHops: 2,
  },
  employee: {
    // 담당자 이탈 → 담당 에이전트 → 영향 과제
    allowedEdges: ['EMPLOYEE_AGENT', 'AGENT_AXPROJECT', 'AGENT_PROJECT'] as EdgeType[],
    defaultHops: 3,
  },
} as const
```

> **설계 의도**: `agent` 시나리오에서 `AGENT_DATA`를 제외한 이유 — 에이전트를 폐기해도 데이터자산은 영향받지 않습니다. 엣지를 무방향으로 저장하되 시나리오에서 필터링하는 방식이, 방향성 엣지를 이중 관리하는 것보다 유지보수가 쉽습니다.

### 5.5 심각도 판정

```ts
export function severityOf(node: GraphNode): Severity {
  if (node.type !== 'agent') return 'LOW'
  const stage = node.meta.lifecycleStage as string
  if (stage === 'ACTIVE') return 'HIGH'        // 운영 중 — 즉시 중단
  if (stage === 'DEGRADED') return 'HIGH'      // 이미 불안정 — 추가 충격 위험
  if (stage === 'GATE3' || stage === 'GATE2') return 'MEDIUM'
  return 'LOW'                                  // DEVELOPING, GATE1
}
```

---

## 6. 라우트 구현

```ts
// app/api/graph/impact/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { getGraph } from '@/lib/graph/cache'
import { traverse } from '@/lib/graph/traverse'
import { SCENARIOS } from '@/lib/graph/scenarios'
import { assembleResult } from '@/lib/graph/assemble'

const VALID_TYPES = ['asset', 'agent', 'employee'] as const

export async function GET(req: NextRequest) {
  const auth = await requireRole('AX_TEAM', 'DATA_PLATFORM', 'C_LEVEL', 'EXECUTIVE')
  if ('error' in auth) return auth.error

  const sp = new URL(req.url).searchParams
  const type = sp.get('type')
  const id = sp.get('id')

  // 입력 검증 — zod 도입 시 스키마로 대체
  if (!type || !VALID_TYPES.includes(type as any)) {
    return NextResponse.json(
      { error: `type은 ${VALID_TYPES.join('|')} 중 하나여야 합니다.` }, { status: 400 })
  }
  if (!id) return NextResponse.json({ error: 'id는 필수입니다.' }, { status: 400 })

  const hopsRaw = Number(sp.get('hops') ?? SCENARIOS[type as keyof typeof SCENARIOS].defaultHops)
  const hops = Number.isInteger(hopsRaw) && hopsRaw >= 1 && hopsRaw <= 4
    ? hopsRaw : SCENARIOS[type as keyof typeof SCENARIOS].defaultHops
  const includeRetired = sp.get('includeRetired') === 'true'

  try {
    const graph = await getGraph()
    const startKey = `${type}:${id}`
    const origin = graph.nodes.get(startKey)
    if (!origin) {
      return NextResponse.json({ error: '대상을 찾을 수 없습니다.' }, { status: 404 })
    }

    const scenario = SCENARIOS[type as keyof typeof SCENARIOS]
    const hits = traverse(graph, startKey, {
      maxHops: hops, allowedEdges: [...scenario.allowedEdges], includeRetired,
    })

    const result = assembleResult(origin, hits, auth.user.role)

    // 영향도 조회는 감사 대상 행위
    await prisma.auditLog.create({ data: {
      entityType: 'Graph', entityId: startKey, action: 'IMPACT_QUERY',
      actorEmail: auth.user.email,
      detail: JSON.stringify({ hops, totalImpacted: result.summary.totalImpacted }),
    }}).catch(e => console.error('[graph/impact] 감사 로그 실패', e))  // 로그 실패가 조회를 막지 않도록

    return NextResponse.json(result)
  } catch (e) {
    console.error('[graph/impact] 조회 실패', e)
    return NextResponse.json({ error: '영향도 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
```

> **`AuditLog` 실패 처리**: 감사 기록 실패가 조회 자체를 막지 않도록 `catch`로 격리했습니다. 단, 감사 요건이 엄격하다면 반대로 "기록 실패 시 조회 거부"가 맞을 수 있으니 컴플라이언스팀과 확인하세요.

---

## 7. 응답 예시

```jsonc
// GET /api/graph/impact?type=asset&id=clx_krx_price
{
  "origin": { "key": "asset:clx_krx_price", "type": "asset", "id": "clx_krx_price",
              "label": "KRX 시세 API",
              "meta": { "classification": "G2", "ownerDept": "데이터플랫폼팀" } },
  "summary": {
    "totalImpacted": 9,
    "highSeverityCount": 2,
    "byType": { "agent": 3, "axproject": 2, "project": 1, "employee": 3, "asset": 0 }
  },
  "impacted": {
    "agents": [
      { "id": "a1", "agentName": "ETF-Rebalance-Agent", "lifecycleStage": "ACTIVE",
        "severity": "HIGH", "distance": 1, "reason": "KRX 시세 API를 READ 권한으로 직접 참조" },
      { "id": "a2", "agentName": "Risk-Monitor", "lifecycleStage": "ACTIVE",
        "severity": "HIGH", "distance": 1, "reason": "KRX 시세 API를 READ 권한으로 직접 참조" },
      { "id": "a3", "agentName": "Daily-Brief", "lifecycleStage": "GATE2",
        "severity": "MEDIUM", "distance": 1, "reason": "KRX 시세 API를 READ 권한으로 직접 참조" }
    ],
    "axprojects": [
      { "id": "p1", "name": "운용 자동화", "linkKind": "AXProject",
        "viaAgents": ["ETF-Rebalance-Agent"] },
      { "id": "p2", "name": "리스크 일일보고", "linkKind": "AXProject",
        "viaAgents": ["Risk-Monitor", "Daily-Brief"] }
    ],
    "projects": [
      { "id": "pr9", "name": "ETF 리밸런싱 자동화 신청", "linkKind": "Project",
        "viaAgents": ["ETF-Rebalance-Agent"] }
    ],
    "assets": []
  },
  "notify": [
    { "employeeId": "e1", "name": "홍길동", "email": "hong@samsungam.com",
      "department": "운용팀", "reason": "AGENT_MANAGER", "resolved": true },
    { "employeeId": "e2", "name": "김철수", "email": "kim@samsungam.com",
      "department": "리스크관리팀", "reason": "AGENT_MANAGER", "resolved": true },
    { "employeeId": "e7", "name": "박영희", "email": "park@samsungam.com",
      "department": "데이터플랫폼팀", "reason": "DATA_OWNER", "resolved": true }
  ],
  "dataQuality": { "unresolvedOwners": 0, "agentsWithoutManager": 1 },
  "warnings": ["담당자가 지정되지 않은 에이전트 1건이 있습니다: Daily-Brief"]
}
```

---

## 8. UI 연결 지점 (Phase 1 필수)

**API만 만들고 화면에 연결하지 않으면 Phase 1은 실패입니다.** 아래 3곳이 최소 요구사항입니다.

### 8.1 폐기 버튼 앞 확인 (`/registry` 슬라이드오버)

현재 "폐기 처리 (RETIRED)" 버튼은 확인 절차 없이 즉시 PATCH를 보냅니다. 그리고 1차 리뷰에서 지적했듯 **`retireReason`도 기록되지 않습니다.** 두 문제를 함께 해결합니다.

```
[폐기 처리] 클릭
  → GET /api/graph/impact?type=agent&id={agentId}
  → 확인 모달:
      "이 에이전트를 폐기하면 AI 활용 과제 2건이 영향을 받습니다."
      · 운용 자동화 (AXProject)
      · ETF 리밸런싱 자동화 신청 (Project)
      "통보 대상: 홍길동, 김철수"
      [폐기 사유 입력 — 필수]
      [취소] [폐기 확정]
```

이 한 곳만 구현해도 그래프의 투자 대비 효용이 증명됩니다.

### 8.2 데이터 접근 만료 예정 알림 (`/dp/requests`)

`DataRequest.periodMonths`와 `createdAt`으로 만료일을 계산할 수 있습니다.

```
만료 30일 전 → 해당 assetId로 영향도 조회
             → 영향 에이전트 중 lifecycleStage='ACTIVE'가 있으면
             → Notification 생성 (담당자 + 데이터 오너)
```

배치 스크립트(`scripts/check-data-expiry.ts`)로 구현하고, 기존 `collect-usage` 스크립트와 동일한 방식으로 스케줄링합니다.

### 8.3 `/graph` 화면 재구성

전체 그래프 렌더링을 기본값에서 내리고, **질문 선택 → 결과 목록 → (선택) 시각화** 순서로 재구성합니다.

```
┌─────────────────────────────────────────────┐
│ 무엇을 확인하시겠습니까?                       │
│ ○ 데이터 접근을 회수하면?    [데이터 선택 ▾]   │
│ ○ 에이전트를 폐기하면?       [에이전트 선택 ▾] │
│ ○ 담당자가 이탈하면?         [직원 선택 ▾]     │
│                                [분석]         │
├─────────────────────────────────────────────┤
│ 결과: 영향 대상 9건 (긴급 2건)                 │
│ [목록 보기] [그래프 보기]  ← 목록이 기본 탭     │
└─────────────────────────────────────────────┘
```

기존 cytoscape 코드는 "그래프 보기" 탭에서 **영향 범위 서브그래프만** 렌더링하도록 축소 활용합니다. 노드 5~10개 규모라면 시각화가 오히려 잘 읽힙니다. 전체 그래프를 그리려 하지 마세요.

노드 색상은 `severity`, 엣지는 `EdgeType`으로 구분하고, 노드 클릭 시 해당 에이전트 슬라이드오버로 이동시켜 그래프를 **종착지가 아닌 네비게이션**으로 만듭니다.

---

## 9. 테스트 계획

기존 테스트가 2건뿐이고 거버넌스 로직 커버리지가 0인 상황이므로, 이 기능은 **처음부터 테스트와 함께** 작성합니다.

```ts
// tests/lib/graph.test.ts
describe('traverse', () => {
  test('허용되지 않은 엣지 타입은 따라가지 않는다', ...)
  test('maxHops를 초과하는 노드는 결과에 포함되지 않는다', ...)
  test('순환 경로에서 무한 루프에 빠지지 않는다', ...)
  test('폐기된 에이전트는 결과에 포함되나 전파를 중단한다', ...)
  test('고아 링크(존재하지 않는 노드 참조)는 무시된다', ...)
})

describe('severityOf', () => {
  test('ACTIVE 에이전트는 HIGH', ...)
  test('DEGRADED 에이전트는 HIGH', ...)
  test('DEVELOPING 에이전트는 LOW', ...)
})

// tests/api/graph-impact.test.ts
describe('GET /api/graph/impact', () => {
  test('미인증 요청은 401', ...)
  test('EMPLOYEE 역할은 403', ...)
  test('잘못된 type은 400', ...)
  test('존재하지 않는 id는 404', ...)
  test('hops가 범위를 벗어나면 기본값으로 대체된다', ...)
  test('C_LEVEL 요청 시 G3 자산 상세가 마스킹된다', ...)
})
```

> **선행 조치**: `package.json`에 `"test": "jest"` 스크립트가 없어 현재 테스트 실행이 불가능합니다(2차 리뷰 M-3). 이 작업 전에 추가해야 합니다.

---

## 10. 성능 및 기술 선택

### 10.1 그래프 DB를 쓰지 않는 이유

| 항목 | 현재 규모 |
|---|---|
| 노드 | 에이전트 19 + 자산·과제·직원 ≈ 수백 |
| 엣지 | 링크 테이블 3종 합계 ≈ 수백 |
| BFS 실행 시간 | < 1ms (인메모리) |
| 전체 적재 시간 | < 50ms (SQLite, 8회 병렬 쿼리) |

Neo4j 등 그래프 DB 도입은 **운영 부담만 늘리고 이득이 없습니다.** 재귀 CTE도 불필요합니다. 노드가 수만 개를 넘어설 때 재검토하되, 이 시스템에서 그 시점이 올 가능성은 낮습니다.

### 10.2 PostgreSQL 전환 시 영향

`.env.example`의 WS-D 계획대로 PG로 전환해도 **이 설계는 그대로 동작합니다.** Prisma 쿼리만 사용하므로 DB 방언 의존성이 없습니다. 전환 후에는 링크 테이블에 인덱스를 추가하면 적재가 더 빨라집니다.

```prisma
@@index([agentId])       // AgentDataLink, AgentProjectLink, EmployeeAgentLink
@@index([dataAssetId])   // AgentDataLink
```

---

## 11. Phase 2 확장 — 미승인 데이터 사용 탐지

### 11.1 목표

> "DataRequest가 승인되지 않았는데 AgentDataLink가 이미 존재하는 경우"

`/registry` 슬라이드오버의 "데이터 미승인 경고"를 **전사 단위로 확장**한 것으로, 승인 전 데이터 접근이 실제로 발생했는지 탐지합니다. 감사 대응 자료로 직접 사용됩니다.

### 11.2 현재 데이터로 부분 구현 가능

`DataRequest`에 `agentId`와 `assetId`가 **이미 존재**합니다(둘 다 nullable, 관계 미정의).

```prisma
model DataRequest {
  agentId  String?     // ← 관계 없는 String
  assetId  String?
  asset    DataAsset? @relation(fields: [assetId], references: [id])
  status   String     @default("REQUESTED")
}
```

따라서 `AgentDataLink(agentId, dataAssetId)`에 대해 `DataRequest{ agentId, assetId }`를 조회하면 승인 상태를 소프트 조인할 수 있습니다.

```ts
// 미승인 접근 경로 탐지
const links = await prisma.agentDataLink.findMany()
const requests = await prisma.dataRequest.findMany({
  where: { agentId: { not: null }, assetId: { not: null } },
  select: { agentId: true, assetId: true, status: true },
})
const approved = new Set(
  requests.filter(r => r.status === 'APPROVED' || r.status === 'PROVISIONED')
          .map(r => `${r.agentId}:${r.assetId}`)
)
const violations = links.filter(l => !approved.has(`${l.agentId}:${l.dataAssetId}`))
```

### 11.3 필요한 스키마 변경 (최소 1건)

소프트 조인은 취약합니다. `AgentDataLink`에 **어떤 DataRequest 승인에 근거한 링크인지** 기록하는 FK를 추가하는 것이 정답입니다.

```prisma
model AgentDataLink {
  // ... 기존 필드
  dataRequestId String?      // 이 링크의 근거가 된 승인 건
  dataRequest   DataRequest? @relation(fields: [dataRequestId], references: [id])
}
```

이렇게 하면 `dataRequestId == null`인 링크가 곧 **근거 없는 데이터 접근**이 되어, 탐지 로직이 조인 없이 한 줄로 끝납니다.

### 11.4 선행 과제

**상태값 어휘 정리가 반드시 먼저입니다.** 현재 `DataRequestStatus`는 세 곳에서 서로 다르게 쓰입니다.

| 위치 | 값 |
|---|---|
| `schema.prisma` 주석 | `REQUESTED \| REVIEWING \| SEC_REVIEW \| APPROVED \| ...` |
| `@default` | `REQUESTED` |
| `/api/projects` POST | `DRAFT` |
| `/api/approve` | `DRAFT` → `PENDING` |

`APPROVED` 판정 기준이 확정되지 않으면 위반 탐지가 오탐을 냅니다. `lib/constants.ts`로 단일 출처화한 뒤 진행하세요.

---

## 12. Phase 3 — 시간축

`AuditLog`에 게이트 전환·승인·링크 변경이 축적되면, 특정 시점의 그래프를 재구성할 수 있습니다.

> "3개월 전 이 데이터를 쓰던 에이전트는 무엇이었나?"

감사 대응에서 강력하지만, **`AuditLog` 쓰기가 전 코드베이스에서 0건**인 현 상태로는 불가능합니다. 3장에서 이 API를 첫 기록 지점으로 삼는 이유가 여기 있습니다.

---

## 13. 구현 체크리스트

### 13.1 선행 조건

- [ ] `package.json`에 `"test": "jest"` 추가 (2차 리뷰 M-3)
- [ ] `lib/prisma.ts` 단일화 — `src/lib/db.ts` 제거 (2차 리뷰 H-3)
- [ ] `requireRole()` 사용 확정 — `getServerSession` 직접 호출 금지 (2차 리뷰 H-1)

### 13.2 Phase 1 구현 (예상 2~3일)

| # | 작업 | 산출물 |
|---|---|---|
| 1 | 타입 정의 | `lib/graph/types.ts` |
| 2 | 그래프 적재 | `lib/graph/load.ts` |
| 3 | 캐시 | `lib/graph/cache.ts` |
| 4 | BFS 순회 | `lib/graph/traverse.ts` |
| 5 | 시나리오 정책 | `lib/graph/scenarios.ts` |
| 6 | 결과 조립 + 마스킹 | `lib/graph/assemble.ts` |
| 7 | API 라우트 | `app/api/graph/impact/route.ts` |
| 8 | 단위 테스트 | `tests/lib/graph.test.ts` |
| 9 | API 테스트 | `tests/api/graph-impact.test.ts` |
| 10 | 폐기 확인 모달 | `app/registry/page.tsx` 수정 |
| 11 | `/graph` 재구성 | `app/graph/page.tsx` 수정 |
| 12 | 링크 변경 시 캐시 무효화 | `app/api/registry/links/route.ts` 수정 |

### 13.3 Phase 1 완료 기준

- [ ] 3가지 시나리오가 모두 정확한 결과를 반환
- [ ] 폐기 버튼이 영향도 확인 + 사유 입력 없이는 동작하지 않음
- [ ] `/graph` 기본 화면이 전체 그래프가 아닌 질문 선택 UI
- [ ] `AuditLog`에 조회 기록이 남음
- [ ] 테스트 통과 (`npm test`)

---

## 14. 요약

이 설계의 핵심은 **그래프를 그림이 아니라 질의 엔진으로 재정의**하는 것입니다.

- 새 스키마 없이 **현재 링크 테이블 3종만으로** Phase 1이 완성됩니다
- 산출물의 기본 형태는 **목록**이고, 시각화는 영향 범위 서브그래프에 한정합니다
- 폐기 확인 모달 한 곳만 구현해도 투자 대비 효용이 증명됩니다
- 부수적으로 `AuditLog` 미사용, 폐기 사유 미기록 등 **기존 리뷰의 미해결 항목 2건이 함께 해소**됩니다

이중 프로젝트 모델(`Project` / `AXProject`)은 이 설계에서 분기 처리로 우회했으나, 통합 시 코드가 단순해지므로 **영향도 API를 통합 논의의 근거 자료로 활용**하시기 바랍니다.

---

*본 설계안은 `ax-hub-code-review.md` / `ax-hub-code-review-v2.md`의 코드 스냅샷 기준입니다. `app/graph/page.tsx`가 미제공 상태이므로 8.3절의 재구성 범위는 실제 코드 확인 후 조정이 필요합니다.*
