import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/src/lib/db'

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const deptHead = session.user.email
  const { accountId } = await req.json()

  const account = await db.toolAccount.findUnique({
    where: { id: accountId },
    include: { quota: true },
  })

  if (!account || account.quota?.managedBy !== deptHead) {
    return NextResponse.json({ error: '권한 없음 또는 계정 없음' }, { status: 403 })
  }

  if (account.status === 'RETURNED') {
    return NextResponse.json({ error: '이미 반납된 계정입니다.' }, { status: 400 })
  }

  const updated = await db.toolAccount.update({
    where: { id: accountId },
    data: { status: 'RETURNED', returnedAt: new Date() },
  })

  return NextResponse.json(updated)
}
