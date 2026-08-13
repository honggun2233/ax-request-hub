import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAdapter, VALID_PROVIDERS } from '@/src/lib/ai-gateway/registry'
import { checkQuota, recordUsage } from '@/src/lib/ai-gateway/quota'
import type { ProviderKey } from '@/src/lib/ai-gateway/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  // 1. 인증
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { provider } = await params
  if (!VALID_PROVIDERS.includes(provider as ProviderKey)) {
    return NextResponse.json({ error: `지원하지 않는 provider: ${provider}` }, { status: 400 })
  }

  const employeeId = (session.user as any).id as string
  const level = (session.user as any).currentLevel as string ?? 'L1'
  const providerKey = provider as ProviderKey

  // 2. 어댑터 존재 확인
  const adapter = getAdapter(providerKey)
  if (!adapter.isConfigured()) {
    return NextResponse.json(
      { error: `${provider} API가 아직 설정되지 않았습니다. 관리자에게 문의하세요.` },
      { status: 503 },
    )
  }

  // 3. 쿼터 체크 — 초과 시 즉시 차단
  const quota = await checkQuota(employeeId, level, providerKey)
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: '이번 달 토큰 쿼터를 초과했습니다.',
        quota: { used: quota.used, limit: quota.limit, pct: quota.pct },
      },
      { status: 429 },
    )
  }

  // 4. 요청 파싱
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { messages, model, maxTokens, temperature } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages 배열이 필요합니다.' }, { status: 400 })
  }

  // 5. AI 호출
  let response
  try {
    response = await adapter.complete({ messages, model, maxTokens, temperature })
  } catch (e: any) {
    console.error(`[AIGateway] ${provider} error:`, e.message)
    return NextResponse.json({ error: e.message ?? 'AI 서비스 오류' }, { status: 502 })
  }

  // 6. 사용량 기록 (비동기, 실패해도 응답 차단 안 함)
  recordUsage({
    employeeId,
    inputById: employeeId,
    provider: providerKey,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    totalTokens: response.totalTokens,
    level,
  }).catch(err => console.error('[AIGateway] recordUsage failed:', err))

  return NextResponse.json({
    content: response.content,
    model: response.model,
    provider: response.provider,
    usage: {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      totalTokens: response.totalTokens,
    },
    quota: {
      used: quota.used + response.totalTokens,
      limit: quota.limit,
      remaining: Math.max(0, quota.remaining - response.totalTokens),
    },
  })
}
