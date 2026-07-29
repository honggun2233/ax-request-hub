import { NextResponse } from 'next/server'
import { db } from '@/src/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [projectCount, agentCount, dataAssetCount, employeeCount] = await Promise.all([
    db.aXProject.count(),
    db.agentRegistry.count(),
    db.dataAsset.count(),
    db.employee.count(),
  ])

  const [belongsToCount, consumesCount, managedByCount] = await Promise.all([
    db.agentProjectLink.count(),
    db.agentDataLink.count(),
    db.employeeAgentLink.count(),
  ])

  return NextResponse.json({
    nodes: {
      Project: projectCount,
      Agent: agentCount,
      DataAsset: dataAssetCount,
      Employee: employeeCount,
    },
    edges: {
      BELONGS_TO: belongsToCount,
      CONSUMES: consumesCount,
      OWNED_BY: 0,
      MANAGES: managedByCount,
    },
  })
}
