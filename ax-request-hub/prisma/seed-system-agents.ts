import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SYSTEM_AGENTS = [
  {
    agentName: '요구사항 분석 에이전트',
    agentKey: 'sys-req-analysis',
    purpose: '에이전트 등록 신청서의 요구사항을 구조화하고 명확화합니다.',
    dataSource: 'AX Hub 신청 데이터',
    isSystemAgent: true,
    commonAgentType: 'REQ_ANALYSIS',
    lifecycleStage: 'ACTIVE',
    gate1Passed: true,
    gate2Passed: true,
    gate3Passed: true,
    phase: 'PRODUCTION',
    prodStatus: 'ACTIVE',
    riskType: 2,
  },
  {
    agentName: '아키텍처 설계 에이전트',
    agentKey: 'sys-arch-design',
    purpose: '에이전트 아키텍처 및 데이터 흐름을 설계하고 검증합니다.',
    dataSource: 'AX Hub 기술 표준',
    isSystemAgent: true,
    commonAgentType: 'ARCH_DESIGN',
    lifecycleStage: 'ACTIVE',
    gate1Passed: true,
    gate2Passed: true,
    gate3Passed: true,
    phase: 'PRODUCTION',
    prodStatus: 'ACTIVE',
    riskType: 2,
  },
  {
    agentName: '코드 생성 에이전트',
    agentKey: 'sys-code-gen',
    purpose: '표준 패턴을 기반으로 에이전트 스캐폴딩 코드를 생성합니다.',
    dataSource: 'AX Hub 개발 표준',
    isSystemAgent: true,
    commonAgentType: 'CODE_GEN',
    lifecycleStage: 'ACTIVE',
    gate1Passed: true,
    gate2Passed: true,
    gate3Passed: true,
    phase: 'PRODUCTION',
    prodStatus: 'ACTIVE',
    riskType: 2,
  },
  {
    agentName: '코드 리뷰 에이전트',
    agentKey: 'sys-code-review',
    purpose: 'PR 코드를 자동 리뷰하고 품질 기준 준수 여부를 확인합니다.',
    dataSource: 'GitHub PR 데이터',
    isSystemAgent: true,
    commonAgentType: 'CODE_REVIEW',
    lifecycleStage: 'ACTIVE',
    gate1Passed: true,
    gate2Passed: true,
    gate3Passed: true,
    phase: 'PRODUCTION',
    prodStatus: 'ACTIVE',
    riskType: 2,
  },
  {
    agentName: '테스트 생성 에이전트',
    agentKey: 'sys-test-gen',
    purpose: '비즈니스 로직 단위 테스트 케이스를 자동 생성합니다.',
    dataSource: 'AX Hub 코드베이스',
    isSystemAgent: true,
    commonAgentType: 'TEST_GEN',
    lifecycleStage: 'ACTIVE',
    gate1Passed: true,
    gate2Passed: true,
    gate3Passed: true,
    phase: 'PRODUCTION',
    prodStatus: 'ACTIVE',
    riskType: 2,
  },
]

async function main() {
  console.log('시스템 에이전트 시드 시작...')

  for (const agentData of SYSTEM_AGENTS) {
    const result = await prisma.agentRegistry.upsert({
      where: { agentKey: agentData.agentKey },
      update: {
        isSystemAgent: agentData.isSystemAgent,
        commonAgentType: agentData.commonAgentType,
      },
      create: agentData,
    })
    console.log(`[OK] ${result.agentName} (${result.agentKey})`)
  }

  const count = await prisma.agentRegistry.count({ where: { isSystemAgent: true } })
  console.log(`\n시스템 에이전트 총 ${count}개 등록 완료`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
