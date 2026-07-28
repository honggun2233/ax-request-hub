import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const PROJECTS = [
  {
    key: 'etf-samlab',
    name: 'ETF SAM LAB',
    domain: 'ETF',
    description: 'ETF 신상품 개발 파이프라인 — 테마 발굴 → 인덱스 설계 → 가상 운용 → 트랙레코드',
    owner: '운용역',
    status: 'ACTIVE',
  },
  {
    key: 'dms',
    name: 'DMS 문서관리',
    domain: '운영',
    description: '전사 문서 자동 분류(G1/G2/G3), 자연어 검색 보조',
    owner: 'CHRO',
    status: 'ACTIVE',
  },
  {
    key: 'it-budget',
    name: 'IT 예산관리',
    domain: '운영',
    description: '2027 경영계획 편성 자동화 및 월별 집행 실적 모니터링',
    owner: 'CFO',
    status: 'ACTIVE',
  },
  {
    key: 'bizops',
    name: '업무 효율화',
    domain: '효율화',
    description: 'STT 회의록 자동화, 공시 보고서 초안 생성 등 반복 업무 자동화',
    owner: 'CTO',
    status: 'ACTIVE',
  },
  {
    key: 'ax-hub',
    name: 'AX Hub 내부',
    domain: '거버넌스',
    description: 'AX 과제 평가 에이전트, AI 리터러시 코칭 — AX Hub 시스템 자체 운영',
    owner: 'CTO',
    status: 'ACTIVE',
  },
]

// agentKey → [{ projectKey, role }]
const LINKS: Record<string, { projectKey: string; role: string }[]> = {
  // ETF SAM LAB — 앙상블 에이전트 19종
  analyst_signal:  [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  commodity:       [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  competition:     [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  compliance_signal: [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  differentiation: [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  earnings:        [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  flow:            [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  global_flow:     [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  investor_demand: [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  liquidity:       [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  macro:           [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  market_cycle:    [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  momentum:        [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  policy:          [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  quality:         [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  risk:            [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  tech_signal:     [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  thematic:        [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],
  value:           [{ projectKey: 'etf-samlab', role: 'PRIMARY' }],

  // DMS
  'dms-classifier':    [{ projectKey: 'dms', role: 'PRIMARY' }],
  'dms-search-assist': [{ projectKey: 'dms', role: 'PRIMARY' }],

  // IT 예산관리
  'it-budget-planner':  [{ projectKey: 'it-budget', role: 'PRIMARY' }],
  'it-budget-monitor':  [{ projectKey: 'it-budget', role: 'PRIMARY' }],

  // 업무 효율화
  'stt-minutes':       [{ projectKey: 'bizops', role: 'PRIMARY' }],
  'disclosure-writer': [
    { projectKey: 'bizops', role: 'PRIMARY' },
    { projectKey: 'etf-samlab', role: 'SUPPORTING' }, // ETF 공시에도 활용
  ],

  // AX Hub 내부
  'ax-hub-evaluator':  [{ projectKey: 'ax-hub', role: 'PRIMARY' }],
  'ai-literacy-coach': [{ projectKey: 'ax-hub', role: 'PRIMARY' }],
}

async function main() {
  console.log('── 프로젝트 등록 ──')
  for (const p of PROJECTS) {
    await prisma.aXProject.upsert({
      where: { key: p.key },
      update: p,
      create: p,
    })
    console.log(`✓ ${p.name}`)
  }

  console.log('\n── 에이전트-프로젝트 링크 ──')
  for (const [agentKey, links] of Object.entries(LINKS)) {
    const agent = await prisma.agentRegistry.findUnique({ where: { agentKey } })
    if (!agent) { console.log(`  ⚠ 에이전트 없음: ${agentKey}`); continue }

    for (const { projectKey, role } of links) {
      const project = await prisma.aXProject.findUnique({ where: { key: projectKey } })
      if (!project) { console.log(`  ⚠ 프로젝트 없음: ${projectKey}`); continue }

      await prisma.agentProjectLink.upsert({
        where: { agentId_projectId: { agentId: agent.id, projectId: project.id } },
        update: { role },
        create: { agentId: agent.id, projectId: project.id, role },
      })
      console.log(`  ✓ ${agentKey} → ${projectKey} (${role})`)
    }
  }

  const total = await prisma.agentProjectLink.count()
  console.log(`\n총 링크 ${total}개 완료`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
