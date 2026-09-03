import { ConsultationAgent, ExtractedProject } from '@/src/lib/agents/consultation'

// Mock the anthropic client so tests run without a real API key
jest.mock('@/src/lib/claude', () => ({
  MODEL: 'claude-sonnet-4-6',
  anthropic: {
    messages: {
      create: jest.fn(),
    },
  },
}))

import { anthropic } from '@/src/lib/claude'

const mockCreate = anthropic.messages.create as jest.Mock

describe('ConsultationAgent', () => {
  let agent: ConsultationAgent

  beforeEach(() => {
    agent = new ConsultationAgent()
    mockCreate.mockReset()
  })

  test('초기 메시지가 환영 메시지를 반환한다', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '안녕하세요! AI 과제 신청을 도와드리겠습니다. 어떤 업무를 자동화하고 싶으신가요?' }],
    })

    const response = await agent.start()
    expect(response.message).toBeTruthy()
    expect(response.isComplete).toBe(false)
    expect(response.extracted).toBeNull()
  }, 30000)

  test('continueChat은 메시지 배열을 받아 응답한다', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '감사합니다. 신청 부서와 담당자 이름을 알려주시겠어요?' }],
    })

    const messages = [
      { role: 'user' as const, content: '운용팀입니다. 리서치 보고서 요약 자동화를 하고 싶어요.' },
    ]
    const response = await agent.continueChat(messages)
    expect(response.message).toBeTruthy()
    expect(typeof response.isComplete).toBe('boolean')
  }, 30000)

  test('EXTRACTED 블록이 없으면 continueChat은 isComplete=false를 반환한다', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '네, 관련 데이터의 기밀등급이 어떻게 되나요?' }],
    })

    const messages = [
      { role: 'user' as const, content: '사용자는 10명입니다.' },
    ]
    const response = await agent.continueChat(messages)
    expect(response.isComplete).toBe(false)
    expect(response.extracted).toBeNull()
  }, 30000)

  test('continueChat이 EXTRACTED 블록을 파싱하면 isComplete=true를 반환한다', async () => {
    const extractedJson = JSON.stringify({
      title: '리서치 보고서 요약 자동화',
      department: '운용팀',
      requesterName: '김과장',
      requesterEmail: 'kim@samsung.com',
      description: '주간 PDF 10개 자동 요약',
      asIs: '수동으로 읽고 요약',
      expectedBenefit: '주 5시간 절감',
      confidentialityLevel: 'PUBLIC',
      championName: '김과장',
      estimatedUsers: 5,
    })
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: `모든 정보가 수집되었습니다. 과제를 등록해 드리겠습니다.\n<EXTRACTED>\n${extractedJson}\n</EXTRACTED>` }],
    })

    const messages = [
      { role: 'user' as const, content: '챔피언은 김과장이고 사용자는 5명입니다.' },
    ]
    const response = await agent.continueChat(messages)
    expect(response.isComplete).toBe(true)
    expect(response.extracted).not.toBeNull()
    expect(response.extracted?.title).toBe('리서치 보고서 요약 자동화')
    expect(response.extracted?.confidentialityLevel).toBe('PUBLIC')
    // The EXTRACTED block should be stripped from the message
    expect(response.message).not.toContain('<EXTRACTED>')
  })
})
