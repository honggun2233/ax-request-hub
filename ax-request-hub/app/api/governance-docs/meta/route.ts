import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/governance-docs/meta  → 전체 메타데이터 목록
export async function GET() {
  const docs = await prisma.governanceDoc.findMany({
    orderBy: [{ type: 'asc' }, { docId: 'asc' }],
  })
  return NextResponse.json({ docs })
}

// POST /api/governance-docs/meta  → 메타데이터 등록 (Admin)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any).role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const { docId, fileName, type, level, title, version, author,
          approvedBy, approvedAt, securityLevel, status, description, relatedDocs } = body

  if (!docId || !fileName || !type || !title) {
    return NextResponse.json({ error: 'docId, fileName, type, title 필수' }, { status: 400 })
  }

  const doc = await prisma.governanceDoc.upsert({
    where: { docId },
    create: {
      docId, fileName, type, level: level || 'L2', title,
      version: version || 'v1.0', author: author || '',
      approvedBy: approvedBy || '', securityLevel: securityLevel || 'RESTRICTED',
      status: status || 'active', description: description || '',
      relatedDocs: JSON.stringify(relatedDocs || []),
      approvedAt: approvedAt ? new Date(approvedAt) : null,
    },
    update: {
      fileName, type, level: level || 'L2', title,
      version: version || 'v1.0', author: author || '',
      approvedBy: approvedBy || '', securityLevel: securityLevel || 'RESTRICTED',
      status: status || 'active', description: description || '',
      relatedDocs: JSON.stringify(relatedDocs || []),
      approvedAt: approvedAt ? new Date(approvedAt) : null,
    },
  })

  return NextResponse.json({ doc })
}

// PATCH /api/governance-docs/meta  → 상태 변경 (Admin)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any).role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const doc = await prisma.governanceDoc.update({
    where: { id },
    data: {
      ...updates,
      approvedAt: updates.approvedAt ? new Date(updates.approvedAt) : undefined,
      relatedDocs: updates.relatedDocs ? JSON.stringify(updates.relatedDocs) : undefined,
    },
  })
  return NextResponse.json({ doc })
}
