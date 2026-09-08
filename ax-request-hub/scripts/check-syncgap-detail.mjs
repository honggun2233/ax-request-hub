import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const agents = await prisma.agentRegistry.findMany({
    where: { prodStatus: 'ACTIVE', NOT: { lifecycleStage: 'ACTIVE' } },
    select: {
      id: true, agentName: true, lifecycleStage: true,
      gate1Passed: true, gate2Passed: true, gate3Passed: true,
      operatorTrustScore: true, productionAt: true,
    },
  })

  console.log('\n=== Gate 통과 상세 ===')
  console.table(agents.map(a => ({
    agentName: a.agentName,
    lifecycleStage: a.lifecycleStage,
    gate1Passed: a.gate1Passed,
    gate2Passed: a.gate2Passed,
    gate3Passed: a.gate3Passed,
    operatorTrustScore: a.operatorTrustScore,
    productionAt: a.productionAt?.toISOString().slice(0, 10) ?? null,
  })))

  // AuditLog 조회
  console.log('\n=== AuditLog (COUNCIL_DECISION / GATE_TRANSITION / 최근 10건/에이전트) ===')
  for (const a of agents) {
    const logs = await prisma.auditLog.findMany({
      where: { entityId: a.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    console.log(`\n[${a.agentName}]`)
    if (logs.length === 0) {
      console.log('  이력 없음')
    } else {
      console.table(logs.map(l => ({
        action: l.action,
        actorEmail: l.actorEmail,
        createdAt: l.createdAt.toISOString().slice(0, 16),
        detail: l.detail ? JSON.stringify(JSON.parse(l.detail)).slice(0, 80) : null,
      })))
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
