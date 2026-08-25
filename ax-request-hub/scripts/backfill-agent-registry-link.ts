/**
 * 기존 Agent 레코드 중 agentRegistryId가 없는 것을 이름 매칭으로 연결.
 * dry-run 기본값 — 실제 반영은 --apply 플래그로만.
 *
 * 실행: npx ts-node scripts/backfill-agent-registry-link.ts
 * 반영: npx ts-node scripts/backfill-agent-registry-link.ts --apply
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const unlinked = await prisma.agent.findMany({
    where: { agentRegistryId: null },
  })

  console.log(`agentRegistryId 없는 Agent: ${unlinked.length}건`)

  const matches: { agentId: string; agentName: string; registryId: string; registryName: string }[] = []
  const unmatched: string[] = []

  for (const agent of unlinked) {
    const registry = await prisma.agentRegistry.findFirst({
      where: { agentName: agent.name },
    })
    if (registry) {
      matches.push({
        agentId: agent.id,
        agentName: agent.name,
        registryId: registry.id,
        registryName: registry.agentName,
      })
    } else {
      unmatched.push(agent.name)
    }
  }

  console.log(`\n매칭됨: ${matches.length}건`)
  if (matches.length > 0) console.table(matches)

  console.log(`\n매칭 안 됨: ${unmatched.length}건`)
  if (unmatched.length > 0) console.log(unmatched)

  if (process.argv.includes('--apply')) {
    for (const m of matches) {
      await prisma.agent.update({ where: { id: m.agentId }, data: { agentRegistryId: m.registryId } })
    }
    console.log('\n반영 완료')
  } else {
    console.log('\ndry-run 모드입니다. 실제 반영하려면 --apply 플래그를 추가하세요.')
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
