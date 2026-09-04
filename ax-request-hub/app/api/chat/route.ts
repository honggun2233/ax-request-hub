import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConsultationAgent } from '@/src/lib/agents/consultation'
import { checkPolicy } from '@/lib/gateway/policy'
import { prisma } from '@/lib/prisma'

const CONSULTATION_AGENT_KEY = 'consultation-bot'

export async function POST(req: NextRequest) {
  // 인증 — employeeId 없이는 감사로그 추�� 불가
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }
  const employeeId = (session.user as any).id as string

  try {
    const body = await req.json()
    const { sessionId, userMessage } = body as { sessionId?: string; userMessage?: string }

    // Policy Gateway — consultation 봇 agentId 조회 후 판정
    const consultationBot = await prisma.agentRegistry.findUnique({
      where: { agentKey: CONSULTATION_AGENT_KEY },
      select: { id: true },
    })
    if (consultationBot) {
      const policy = await checkPolicy(consultationBot.id, employeeId)
      if (policy.decision === 'BLOCK') {
        return NextResponse.json({ error: policy.reason }, { status: 403 })
      }
      // WARN은 계속 진행 — 클라이언트에 warning 포함 응답
    }

    const agent = new ConsultationAgent()

    if (!sessionId) {
      // 새 세션 시작
      const agentResponse = await agent.start()
      const chatSession = await prisma.chatSession.create({
        data: {
          employeeId,
          messages: JSON.stringify([
            { role: 'assistant', content: agentResponse.message },
          ]),
        },
      })
      return NextResponse.json({
        sessionId: chatSession.id,
        message: agentResponse.message,
        isComplete: agentResponse.isComplete,
        extracted: agentResponse.extracted,
        ...(consultationBot ? {} : {}),
      })
    }

    // 기존 세션 이어가기
    const chatSession = await prisma.chatSession.findUnique({ where: { id: sessionId } })
    if (!chatSession) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 세션 소유자 확인 — 다른 직원의 세션 접근 차단
    if (chatSession.employeeId && chatSession.employeeId !== employeeId) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    const history = JSON.parse(chatSession.messages as string)
    if (userMessage) {
      history.push({ role: 'user', content: userMessage })
    }

    const agentResponse = await agent.continueChat(history)
    history.push({ role: 'assistant', content: agentResponse.message })

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(history),
        completedAt: agentResponse.isComplete ? new Date() : null,
      },
    })

    return NextResponse.json({
      sessionId,
      message: agentResponse.message,
      isComplete: agentResponse.isComplete,
      extracted: agentResponse.extracted,
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
