import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ACTOR = 'inpyo.ip.hong@samsung.com'
const TARGETS = ['ETF 상품 추천 에이전트', '공시 문서 분류 에이전트', '리스크 모니터링 에이전트']
const GO_LIVE = new Date('2026-07-10')

async function main() {
  for (const name of TARGETS) {
    const agent = await prisma.agentRegistry.findFirst({ where: { agentName: name } })
    if (!agent) { console.log(`[SKIP] 못 찾음: ${name}`); continue }

    await prisma.$transaction(async (tx) => {
      await tx.agentRegistry.update({
        where: { id: agent.id },
        data: {
          gate1Passed: true, gate1PassedAt: GO_LIVE,
          gate2Passed: true, gate2PassedAt: GO_LIVE,
          gate3Passed: true, gate3PassedAt: GO_LIVE,
          lifecycleStage: 'ACTIVE',
        },
      })
      await tx.auditLog.create({
        data: {
          entityType: 'AgentRegistry',
          entityId: agent.id,
          action: 'LEGACY_EXEMPTION_APPLIED',
          actorEmail: ACTOR,
          detail: JSON.stringify({
            reason: 'ETF 시스템 go-live(2026-07-10) 시점 시드 데이터로 등재된 에이전트. 당시 AX Hub 심사 체계 미비로 정규 절차 미이수. 운영 이력 확인 후 PO 승인으로 사후 면제 처리.',
            approvedBy: '홍인표',
            approvedAt: new Date().toISOString(),
          }),
        },
      })
    })
    console.log(`[OK] ${name} — lifecycleStage=ACTIVE, gate*=true, AuditLog 기록`)
  }

  // 최종 확인
  const remaining = await prisma.agentRegistry.count({
    where: { prodStatus: 'ACTIVE', NOT: { lifecycleStage: 'ACTIVE' } },
  })
  console.log(`\nsyncGap 잔여: ${remaining}건`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
