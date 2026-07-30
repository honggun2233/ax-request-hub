import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [agentCount, projectCount, dataAssetCount, employeeCount] = await Promise.all([
      prisma.agent.count(),
      prisma.project.count(),
      prisma.dataAsset.count(),
      prisma.employee.count(),
    ])

    const totalNodes = agentCount + projectCount + dataAssetCount + employeeCount

    return NextResponse.json({
      totalNodes,
      byType: {
        Agent: agentCount,
        Project: projectCount,
        DataAsset: dataAssetCount,
        Employee: employeeCount,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })
  }
}
