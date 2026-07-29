import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const agentDataLinks = [
  // ETF SAM LAB 에이전트들 — ETF 일별 기준가 사용
  { agentId: 'cmrk1vw9i00003sx528gf5mol', dataAssetId: 'cmrww3j7e0000xo81sqkqhpwc', purpose: 'ETF 모멘텀 계산', accessLevel: 'READ' },
  { agentId: 'cmrk1vwfj00013sx5qb5kljb9', dataAssetId: 'cmrww3j7e0000xo81sqkqhpwc', purpose: '테마별 ETF 성과 분석', accessLevel: 'READ' },
  { agentId: 'cmrk1vwfu00023sx56ichm6kp', dataAssetId: 'cmrww3j7e0000xo81sqkqhpwc', purpose: '거시경제 ETF 연동', accessLevel: 'READ' },
  // 시장 지수 시계열 사용 에이전트들
  { agentId: 'cmrk1vw9i00003sx528gf5mol', dataAssetId: 'cmrww3j7p0002xo81w8v0cijh', purpose: '벤치마크 비교', accessLevel: 'READ' },
  { agentId: 'cmrk1vwfu00023sx56ichm6kp', dataAssetId: 'cmrww3j7p0002xo81w8v0cijh', purpose: '거시경제 지수 분석', accessLevel: 'READ' },
  { agentId: 'cmrk1vwgh00043sx5ub6fnic0', dataAssetId: 'cmrww3j7p0002xo81w8v0cijh', purpose: '리스크 지수 모니터링', accessLevel: 'READ' },
  // 운용 성과 원장 (G3) — READ 전용
  { agentId: 'cmrk1vwg400033sx5fizmmr6x', dataAssetId: 'cmrww3j7x0004xo81o7uy7n3q', purpose: '가치 평가 기준선', accessLevel: 'READ' },
  { agentId: 'cmrk1vwgh00043sx5ub6fnic0', dataAssetId: 'cmrww3j8h0009xo819dmlff94', purpose: '리스크 지표 집계', accessLevel: 'READ' },
  // 공시 문서 아카이브 (G1)
  { agentId: 'cmrk1vwlx000i3sx54enqzif3', dataAssetId: 'cmrww3j890007xo812y9n1u6u', purpose: '컴플라이언스 신호 탐지', accessLevel: 'READ' },
  // IT 예산 편성 에이전트
  { agentId: 'cmrlrl5q20000ov3dbgn2rglj', dataAssetId: 'cmrww3j810005xo81k3r0qx6b', purpose: '예산 집행 현황 참조', accessLevel: 'READ' },
  { agentId: 'cmrlrl5q20000ov3dbgn2rglj', dataAssetId: 'cmrww3j840006xo819iyhidx4', purpose: '규정 문서 참조', accessLevel: 'READ' },
]

const employeeAgentLinks = [
  // 김지수 (AX_TEAM): ETF SAM LAB 에이전트 관리
  { employeeId: 'cmrecc5ym000111jh7af5ieu7', agentId: 'cmrk1vw9i00003sx528gf5mol', role: 'MANAGER' },
  { employeeId: 'cmrecc5ym000111jh7af5ieu7', agentId: 'cmrk1vwfj00013sx5qb5kljb9', role: 'MANAGER' },
  { employeeId: 'cmrecc5ym000111jh7af5ieu7', agentId: 'cmrk1vwfu00023sx56ichm6kp', role: 'MANAGER' },
  // 오현석 (MANAGER): 리스크/컴플라이언스 에이전트
  { employeeId: 'cmrecc642000911jh3gf5yjko', agentId: 'cmrk1vwgh00043sx5ub6fnic0', role: 'MANAGER' },
  { employeeId: 'cmrecc642000911jh3gf5yjko', agentId: 'cmrk1vwlx000i3sx54enqzif3', role: 'MANAGER' },
  // 최재원 (MANAGER): IT 예산 에이전트
  { employeeId: 'cmrecc606000411jh9wpg4rvj', agentId: 'cmrlrl5q20000ov3dbgn2rglj', role: 'MANAGER' },
  // AX팀 관리자: 전체 협업자
  { employeeId: 'cmrcxsug30000xzyalftllhp3', agentId: 'cmrk1vwg400033sx5fizmmr6x', role: 'COLLABORATOR' },
]

async function main() {
  console.log('그래프 시드 데이터 입력 중...')

  // upsert 방식 — 중복 실행 안전
  for (const link of agentDataLinks) {
    await prisma.agentDataLink.upsert({
      where: { agentId_dataAssetId: { agentId: link.agentId, dataAssetId: link.dataAssetId } },
      update: {},
      create: link,
    })
  }

  for (const link of employeeAgentLinks) {
    await prisma.employeeAgentLink.upsert({
      where: { employeeId_agentId: { employeeId: link.employeeId, agentId: link.agentId } },
      update: {},
      create: link,
    })
  }

  console.log(`AgentDataLink ${agentDataLinks.length}건, EmployeeAgentLink ${employeeAgentLinks.length}건 완료`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
