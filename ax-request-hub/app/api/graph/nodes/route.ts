import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type NodeType = 'Agent' | 'Project' | 'DataAsset' | 'Employee'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as NodeType | null
  const status = searchParams.get('status')

  const nodes: unknown[] = []

  if (!type || type === 'Agent') {
    const agents = await db.agentRegistry.findMany({
      where: status ? { status } : undefined,
      select: { id: true, agentName: true, lifecycleStage: true, trustScore: true },
    })
    nodes.push(
      ...agents.map((a) => ({
        id: a.id,
        name: a.agentName,
        lifecycleStage: a.lifecycleStage,
        trustScore: a.trustScore,
        type: 'Agent' as const,
      }))
    )
  }

  if (!type || type === 'Project') {
    const projects = await db.aXProject.findMany({
      where: status ? { status } : undefined,
      select: { id: true, name: true, status: true },
    })
    nodes.push(
      ...projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        riskLevel: null,
        type: 'Project' as const,
      }))
    )
  }

  if (!type || type === 'DataAsset') {
    const assets = await db.dataAsset.findMany({
      select: { id: true, name: true, classification: true, ownerDept: true },
    })
    nodes.push(
      ...assets.map((d) => ({
        id: d.id,
        name: d.name,
        secretLevel: d.classification,
        owner: d.ownerDept,
        type: 'DataAsset' as const,
      }))
    )
  }

  if (!type || type === 'Employee') {
    const employees = await db.employee.findMany({
      where: status ? { isActive: status === 'active' } : undefined,
      select: { id: true, name: true, department: true, currentLevel: true },
    })
    nodes.push(
      ...employees.map((e) => ({
        id: e.id,
        name: e.name,
        dept: e.department,
        literacyLevel: e.currentLevel,
        type: 'Employee' as const,
      }))
    )
  }

  return NextResponse.json(nodes)
}
