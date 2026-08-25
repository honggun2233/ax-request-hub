import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const [dataAsset, agent, project, agentProjectLink, dataRequest] = await Promise.all([
    p.dataAsset.count(),
    p.agent.count(),
    p.project.count(),
    p.agentProjectLink.count(),
    p.dataRequest.count({ where: { assetId: { not: null } } }),
  ])
  console.log(JSON.stringify({ dataAsset, agent, project, agentProjectLink, dataRequest_with_asset: dataRequest }))
}

main().catch(console.error).finally(() => p.$disconnect())
