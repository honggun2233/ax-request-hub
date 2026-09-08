import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const agents = await prisma.agentRegistry.findMany({
    select: { id: true, agentName: true, lifecycleStage: true, prodStatus: true },
  })

  const gaps = agents.filter(a => a.prodStatus === 'ACTIVE' && a.lifecycleStage !== 'ACTIVE')

  console.log('\n=== syncGap 현황 ===')
  console.log('전체 에이전트:', agents.length)
  console.log('syncGap 건수:', gaps.length)

  if (gaps.length > 0) {
    console.log('\n[수동 복구 대상]')
    console.table(gaps.map(g => ({
      id: g.id,
      agentName: g.agentName,
      lifecycleStage: g.lifecycleStage,
      prodStatus: g.prodStatus,
    })))
  } else {
    console.log('✅ syncGap 없음')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
