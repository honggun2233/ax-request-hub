import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'

jest.mock('@/src/lib/agents/consultation', () => ({
  ConsultationAgent: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue({
      message: '안녕하세요! AI 과제 신청을 도와드리겠습니다.',
      isComplete: false,
      extracted: null,
    }),
    continueChat: jest.fn().mockResolvedValue({
      message: '과제명을 알려주세요.',
      isComplete: false,
      extracted: null,
    }),
  })),
}))

jest.mock('@/src/lib/db', () => ({
  db: {
    chatSession: {
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        messages: JSON.stringify([]),
      }),
      update: jest.fn().mockResolvedValue({ id: 'session-1' }),
    },
  },
}))

describe('POST /api/chat', () => {
  test('sessionId 없으면 새 세션 시작', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.sessionId).toBeTruthy()
    expect(data.message).toBeTruthy()
    expect(typeof data.isComplete).toBe('boolean')
  })

  test('sessionId 있으면 대화 계속', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'session-1', userMessage: '운용팀입니다' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.message).toBeTruthy()
  })
})
