import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const AGENTS = [
  // ── IT Budget ──────────────────────────────────────────────────
  {
    agentName: 'IT 예산 편성 자동화 에이전트',
    agentKey: 'it-budget-planner',
    version: '1.0.0',
    purpose: '부서별 IT 예산 요구안 수집·분석 후 경영계획 초안 자동 생성',
    dataSource: '부서 제출 엑셀, ERP 실집행 데이터',
    owner: 'CFO',
    lifecycleStage: 'GATE2',
    gate1Passed: true,
    gate2Passed: false,
    gate3Passed: false,
    fallbackRate: 0.28,
    notes: '2027 경영계획 편성 7월 내 사용 목표. Gate2 도메인 검토 중.',
  },
  {
    agentName: 'IT 예산 집행 모니터 에이전트',
    agentKey: 'it-budget-monitor',
    version: '0.9.0',
    purpose: '월별 IT 비용 실적 vs 계획 대비 이상 항목 자동 감지 및 알림',
    dataSource: 'ERP 집행 데이터, Knox 연동',
    owner: 'CFO',
    lifecycleStage: 'GATE1',
    gate1Passed: false,
    gate2Passed: false,
    gate3Passed: false,
    fallbackRate: 0.55,
    notes: 'QA fallback율 검증 중. Knox 연동 미완.',
  },
  // ── DMS ───────────────────────────────────────────────────────
  {
    agentName: 'DMS 문서 자동 분류 에이전트',
    agentKey: 'dms-classifier',
    version: '1.1.0',
    purpose: '업로드 문서를 기밀등급(G1/G2/G3) 및 카테고리 자동 분류',
    dataSource: '문서관리시스템(DMS) 업로드 스트림',
    owner: 'CHRO',
    lifecycleStage: 'GATE3',
    gate1Passed: true,
    gate2Passed: true,
    gate3Passed: false,
    fallbackRate: 0.12,
    notes: '스트레스 테스트 단계. G3 기밀 문서 온프레미스 처리 확인 필요.',
  },
  {
    agentName: 'DMS 문서 검색 보조 에이전트',
    agentKey: 'dms-search-assist',
    version: '1.0.0',
    purpose: '자연어 질의로 사내 문서 검색 및 요약 제공',
    dataSource: 'DMS 인덱스 (G1/G2 문서만)',
    owner: 'CHRO',
    lifecycleStage: 'ACTIVE',
    gate1Passed: true,
    gate2Passed: true,
    gate3Passed: true,
    fallbackRate: 0.08,
    notes: '파일럿 완료. ACTIVE 전환. G3 문서 검색은 추후 온프레미스 확장 예정.',
  },
  // ── 업무 효율화 ────────────────────────────────────────────────
  {
    agentName: 'STT 회의록 자동화 에이전트',
    agentKey: 'stt-minutes',
    version: '0.5.0',
    purpose: '회의 음성 자동 전사 → 요약 → 액션아이템 추출',
    dataSource: 'STT 엔진 출력(Clova/Azure), 내부 회의 음성',
    owner: 'CTO',
    lifecycleStage: 'DEVELOPING',
    gate1Passed: false,
    gate2Passed: false,
    gate3Passed: false,
    fallbackRate: 1.0,
    notes: '6/18 STT 패킷 분석 미팅 이후 개발 착수. Gate1 대기 중.',
  },
  {
    agentName: '공시 보고서 자동 작성 에이전트',
    agentKey: 'disclosure-writer',
    version: '1.0.0',
    purpose: '36건 정기공시 초안 자동 생성 및 컴플라이언스 체크',
    dataSource: '운용 포지션 데이터(G3), 전자공시 템플릿',
    owner: 'CTO',
    lifecycleStage: 'GATE2',
    gate1Passed: true,
    gate2Passed: false,
    gate3Passed: false,
    fallbackRate: 0.33,
    notes: 'G3 데이터 포함 — 온프레미스 배포 필수. 운용역 도메인 리뷰 대기.',
  },
  {
    agentName: 'AI 리터러시 코칭 에이전트',
    agentKey: 'ai-literacy-coach',
    version: '1.2.0',
    purpose: '임직원 AI 리터러시 레벨 진단 및 맞춤형 교육 큐레이션',
    dataSource: '레벨 평가 결과, 학습 이력 DB',
    owner: 'CTO',
    lifecycleStage: 'ACTIVE',
    gate1Passed: true,
    gate2Passed: true,
    gate3Passed: true,
    fallbackRate: 0.05,
    notes: 'Level 1~4 전 임직원 대상. 2026.08 본격 운영 예정.',
  },
  // ── AX Hub 자체 ────────────────────────────────────────────────
  {
    agentName: 'AX Hub 과제 평가 에이전트',
    agentKey: 'ax-hub-evaluator',
    version: '2.0.0',
    purpose: '신청 과제 6차원 자동 평가 및 승인 판정',
    dataSource: 'AX Request Hub 신청서',
    owner: 'CTO',
    lifecycleStage: 'ACTIVE',
    gate1Passed: true,
    gate2Passed: true,
    gate3Passed: true,
    fallbackRate: 0.02,
    notes: '현재 운영 중인 AX Hub 핵심 에이전트. 평균 응답 30초.',
  },
]

async function main() {
  for (const agent of AGENTS) {
    await prisma.agentRegistry.upsert({
      where: { agentKey: agent.agentKey },
      update: agent,
      create: agent,
    })
    console.log(`✓ ${agent.agentName} (${agent.lifecycleStage})`)
  }
  console.log(`\n총 ${AGENTS.length}개 에이전트 추가 완료`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
