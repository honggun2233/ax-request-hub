import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // 개발 단계: role 제한 없음
    const userId = (session.user as any)?.id

    const body = await req.json()
    const { requestId, deliveryMode, connectionRef, expiresAt } = body

    const provision = await prisma.dataProvision.create({
      data: {
        requestId,
        deliveryMode,
        connectionRef,
        expiresAt: new Date(expiresAt),
      },
    })

    await prisma.dataRequest.update({
      where: { id: requestId },
      data: { status: 'PROVISIONED', reviewerId: userId },
    })

    // SNOWFLAKE/AWS_GLUE 외부 데이터는 데이터플랫폼팀에 수동 처리 요청
    const dataRequest = await prisma.dataRequest.findUnique({
      where: { id: requestId },
      include: { asset: { select: { sourceSystem: true, externalId: true, name: true } } },
    })
    const asset = dataRequest?.asset
    if (asset && ['SNOWFLAKE', 'AWS_GLUE'].includes(asset.sourceSystem)) {
      const dpEmails = await prisma.employee
        .findMany({ where: { role: 'DATA_PLATFORM' }, select: { email: true } })
        .then((r) => r.map((e) => e.email))
      if (dpEmails.length > 0) {
        await notify(
          {
            type: 'DATA_REQUEST_UPDATE',
            title: `외부 데이터 접근 권한 처리 필요 — ${asset.name}`,
            body: `${asset.sourceSystem} [${asset.externalId ?? ''}] 접근 권한을 수동으로 부여해주세요.`,
            link: `/dp/requests`,
            metadata: { provisionId: provision.id, sourceSystem: asset.sourceSystem },
          },
          dpEmails,
        )
      }
    }

    return NextResponse.json(provision, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
