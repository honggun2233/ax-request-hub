import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')

    const nodes: unknown[] = []

    if (!type || type === 'Agent') {
      const agents = await prisma.agent.findMany({
        select: { id: true, name: true, status: true, department: true },
      })
      nodes.push(...agents.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        dept: a.department,
        type: 'Agent' as const,
      })))
    }

    if (!type || type === 'Project') {
      const projects = await prisma.project.findMany({
        select: { id: true, title: true, status: true, department: true, confidentialityLevel: true },
      })
      nodes.push(...projects.map((p) => ({
        id: p.id,
        name: p.title,
        status: p.status,
        dept: p.department,
        type: 'Project' as const,
      })))
    }

    if (!type || type === 'DataAsset') {
      const assets = await prisma.dataAsset.findMany({
        select: { id: true, name: true, classification: true, ownerDept: true },
      })
      nodes.push(...assets.map((d) => ({
        id: d.id,
        name: d.name,
        secretLevel: d.classification,
        dept: d.ownerDept,
        type: 'DataAsset' as const,
      })))
    }

    if (!type || type === 'Employee') {
      const employees = await prisma.employee.findMany({
        select: { id: true, name: true, department: true, currentLevel: true },
      })
      nodes.push(...employees.map((e) => ({
        id: e.id,
        name: e.name,
        dept: e.department,
        type: 'Employee' as const,
      })))
    }

    return NextResponse.json(nodes)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })
  }
}
