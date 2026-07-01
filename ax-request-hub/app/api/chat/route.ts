import { NextRequest, NextResponse } from 'next/server'
import { ConsultationAgent } from '@/src/lib/agents/consultation'
import { db } from '@/src/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, userMessage } = body as { sessionId?: string; userMessage?: string }

    const agent = new ConsultationAgent()

    if (!sessionId) {
      // 새 세션 시작
      const agentResponse = await agent.start()
      const session = await db.chatSession.create({
        data: {
          messages: JSON.stringify([
            { role: 'assistant', content: agentResponse.message },
          ]),
        },
      })
      return NextResponse.json({
        sessionId: session.id,
        message: agentResponse.message,
        isComplete: agentResponse.isComplete,
        extracted: agentResponse.extracted,
      })
    }

    // 기존 세션 이어가기
    const session = await db.chatSession.findUnique({ where: { id: sessionId } })
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
    }

    const history = JSON.parse(session.messages as string)
    if (userMessage) {
      history.push({ role: 'user', content: userMessage })
    }

    const agentResponse = await agent.continueChat(history)
    history.push({ role: 'assistant', content: agentResponse.message })

    await db.chatSession.update({
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
