import { NextResponse } from 'next/server'
import { checkPolicy } from '@/lib/gateway/policy'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { agentId, employeeId } = body as { agentId: string; employeeId: string }

    if (!agentId || !employeeId) {
      return NextResponse.json(
        { data: { decision: 'BLOCK', reason: 'agentId, employeeId 필수', warnings: [] }, message: '', error: '' },
        { status: 400 },
      )
    }

    const result = await checkPolicy(agentId, employeeId)
    return NextResponse.json({
      data: { decision: result.decision, reason: result.reason, warnings: [] },
      message: '',
      error: '',
    })
  } catch (error) {
    console.error('[policy-check] unhandled error:', error)
    return NextResponse.json(
      {
        data: { decision: 'BLOCK', reason: '정책 판정 오류', warnings: [] },
        message: '',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
