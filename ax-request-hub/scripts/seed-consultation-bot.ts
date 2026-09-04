/**
 * consultation-bot AgentRegistry 등록 스크립트
 * 시스템 에이전트라 Gate 심의 없이 ACTIVE로 직접 등록
 * Run: npx tsx scripts/seed-consultation-bot.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const bot = await prisma.agentRegistry.upsert({
    where: { agentKey: 'consultation-bot' },
    create: {
      agentName: 'AI 활용 신청 상담 봇',
      agentKey: 'consultation-bot',
      version: '1.0.0',
      purpose: '임직원 AI 활용 신청 접수 및 정보 수집 (7개 항목 대화형 수집)',
      dataSource: 'AX Hub 내부 (대화 세션만, 외부 데이터 미접근)',
      owner: 'AX_TEAM',
      lifecycleStage: 'ACTIVE',
      gate1Passed: true,
      gate2Passed: true,
      gate3Passed: true,
      gate1PassedAt: new Date(),
      gate2PassedAt: new Date(),
      gate3PassedAt: new Date(),
      notes: '시스템 에이전트 — /api/chat 엔드포인트 전용. Gate 심의 면제 (AX_TEAM 직접 등록).',
    },
    update: {
      lifecycleStage: 'ACTIVE',
    },
  })

  console.log(`consultation-bot 등록 완료: id=${bot.id}, agentKey=${bot.agentKey}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
