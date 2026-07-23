import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const projects = await prisma.aXProject.findMany({
    include: {
      agents: {
        include: {
          agent: {
            select: {
              id: true,
              agentName: true,
              agentKey: true,
              lifecycleStage: true,
              fallbackRate: true,
              gate1Passed: true,
              gate2Passed: true,
              gate3Passed: true,
              owner: true,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ projects })
}
