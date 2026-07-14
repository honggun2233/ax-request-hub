import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ETF_AGENTS = [
  { agentName: 'MomentumAgent', agentKey: 'momentum', purpose: '가격 모멘텀 (52주 수익률·MA)', dataSource: 'provider.get_price_history()', realDataConnected: false, fallbackRate: 1.0, gate1Passed: false, gate2Passed: false, gate3Passed: false, notes: 'YfinanceProvider 구현 완료 시 실연결 전환 예정' },
  { agentName: 'ThematicAgent', agentKey: 'thematic', purpose: '네이버 트렌드 키워드 관심도', dataSource: 'get_trend_score() + ensemble.db', realDataConnected: false, fallbackRate: 0.8, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'MacroAgent', agentKey: 'macro', purpose: '금리·환율·VIX 매크로 환경', dataSource: 'get_macro_indicators()', realDataConnected: false, fallbackRate: 1.0, gate1Passed: false, gate2Passed: false, gate3Passed: false, notes: 'FRED API 연결 필요' },
  { agentName: 'ValueAgent', agentKey: 'value', purpose: 'PER·PBR·배당수익률 가치평가', dataSource: 'get_fundamental()', realDataConnected: false, fallbackRate: 1.0, gate1Passed: false, gate2Passed: false, gate3Passed: false },
  { agentName: 'RiskAgent', agentKey: 'risk', purpose: '변동성·최대낙폭·베타', dataSource: 'get_price_history()', realDataConnected: false, fallbackRate: 1.0, gate1Passed: false, gate2Passed: false, gate3Passed: false },
  { agentName: 'EarningsAgent', agentKey: 'earnings', purpose: 'EPS 성장·어닝비트율', dataSource: 'get_fundamental()', realDataConnected: false, fallbackRate: 1.0, gate1Passed: false, gate2Passed: false, gate3Passed: false },
  { agentName: 'FlowAgent', agentKey: 'flow', purpose: '기관 순매수 방향', dataSource: 'get_fundamental().institutional_flow', realDataConnected: false, fallbackRate: 1.0, gate1Passed: false, gate2Passed: false, gate3Passed: false },
  { agentName: 'CompetitionAgent', agentKey: 'competition', purpose: '동일테마 ETF 경쟁사 수', dataSource: 'get_fundamental().competitor_count', realDataConnected: false, fallbackRate: 1.0, gate1Passed: false, gate2Passed: false, gate3Passed: false },
  { agentName: 'QualityAgent', agentKey: 'quality', purpose: 'ROE·부채비율·FCF 퀄리티', dataSource: 'ensemble.db ds_company_financials', realDataConnected: true, fallbackRate: 0.5, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'GlobalFlowAgent', agentKey: 'global_flow', purpose: 'FII 순매수·DXY 글로벌 자금 흐름', dataSource: 'ensemble.db + yfinance', realDataConnected: true, fallbackRate: 0.4, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'PolicyAgent', agentKey: 'policy', purpose: '방산예산·지정학 리스크', dataSource: 'ensemble.db policy_signals', realDataConnected: true, fallbackRate: 0.5, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'CommodityAgent', agentKey: 'commodity', purpose: '리튬·구리·배터리 원자재 신호', dataSource: 'ensemble.db + yfinance', realDataConnected: true, fallbackRate: 0.4, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'TechSignalAgent', agentKey: 'tech_signal', purpose: 'AI/반도체 기술 신호', dataSource: 'ensemble.db tech_signals', realDataConnected: true, fallbackRate: 0.3, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'InvestorDemandAgent', agentKey: 'investor_demand', purpose: 'ETF 자금유입·투자자 수요', dataSource: 'ensemble.db', realDataConnected: true, fallbackRate: 0.5, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'MarketCycleAgent', agentKey: 'market_cycle', purpose: '시장 사이클 타이밍 판단', dataSource: 'ensemble.db + yfinance', realDataConnected: true, fallbackRate: 0.4, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'AnalystSignalAgent', agentKey: 'analyst_signal', purpose: '애널리스트 인사이트 집계', dataSource: 'ensemble.db analyst_insights', realDataConnected: true, fallbackRate: 0.6, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'LiquidityAgent', agentKey: 'liquidity', purpose: '거래량·매도충격비용 유동성', dataSource: 'provider DB-first 캐시', realDataConnected: true, fallbackRate: 0.3, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'DifferentiationAgent', agentKey: 'differentiation', purpose: '기존 ETF 대비 차별화도', dataSource: 'ensemble.db + provider', realDataConnected: true, fallbackRate: 0.4, gate1Passed: true, gate2Passed: false, gate3Passed: false },
  { agentName: 'ComplianceSignalAgent', agentKey: 'compliance_signal', purpose: 'KRX 규정·비중한도 컴플라이언스', dataSource: 'KofiaChecker + Anthropic API', realDataConnected: true, fallbackRate: 0.1, gate1Passed: true, gate2Passed: true, gate3Passed: false, notes: '유일하게 Gate2 통과. Anthropic API 연결 필수.' },
]

async function main() {
  console.log('ETF 에이전트 19개 시드 투입 시작...')
  for (const agent of ETF_AGENTS) {
    await prisma.agentRegistry.upsert({
      where: { agentKey: agent.agentKey },
      update: agent,
      create: agent,
    })
    console.log(`  ✓ ${agent.agentName}`)
  }
  const count = await prisma.agentRegistry.count()
  console.log(`\n완료: 총 ${count}개 에이전트 등록`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
