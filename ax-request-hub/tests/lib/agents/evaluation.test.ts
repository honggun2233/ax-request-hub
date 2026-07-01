import { EvaluationAgent, ScoreCardResult } from '@/src/lib/agents/evaluation'
import { ExtractedProject } from '@/src/lib/agents/consultation'

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

const mockProject: ExtractedProject = {
  title: '계약서 검토 자동화',
  department: '법무팀',
  requesterName: '김과장',
  requesterEmail: 'kim@samsung.com',
  description: 'PDF 계약서를 AI로 자동 검토',
  asIs: '변호사가 수동으로 검토, 1건당 2시간',
  expectedBenefit: '주 10시간 절감, 비용 30% 감소',
  confidentialityLevel: 'G2',
  championName: '김과장',
  estimatedUsers: 10,
}

const mockG3Project: ExtractedProject = {
  ...mockProject,
  title: '운용 포지션 AI 분석',
  confidentialityLevel: 'G3',
  description: '펀드 운용 포지션 데이터 AI 분석',
}

describe('EvaluationAgent', () => {
  let agent: EvaluationAgent

  beforeEach(() => {
    agent = new EvaluationAgent()
    mockCreate.mockReset()
  })

  test('evaluate()가 ScoreCardResult를 반환한다', async () => {
    const mockScoreCard = {
      impactScore: 20,
      roiScore: 18,
      confidentialityScore: 10,
      difficultyScore: 12,
      readinessScore: 8,
      strategyScore: 7,
      evaluationRationale: '법무팀 계약서 검토 자동화는 명확한 As-Is와 챔피언이 있어 실행 가능성이 높음.',
    }

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(mockScoreCard) }],
    })

    const result = await agent.evaluate(mockProject)
    expect(result.impactScore).toBeGreaterThanOrEqual(0)
    expect(result.impactScore).toBeLessThanOrEqual(25)
    expect(result.roiScore).toBeGreaterThanOrEqual(0)
    expect(result.roiScore).toBeLessThanOrEqual(25)
    expect(result.confidentialityScore).toBeGreaterThanOrEqual(0)
    expect(result.confidentialityScore).toBeLessThanOrEqual(15)
    expect(result.difficultyScore).toBeGreaterThanOrEqual(0)
    expect(result.difficultyScore).toBeLessThanOrEqual(15)
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(10)
    expect(result.strategyScore).toBeGreaterThanOrEqual(0)
    expect(result.strategyScore).toBeLessThanOrEqual(10)
    expect(result.totalScore).toBe(
      result.impactScore + result.roiScore + result.confidentialityScore +
      result.difficultyScore + result.readinessScore + result.strategyScore
    )
    expect(result.evaluationRationale).toBeTruthy()
  }, 30000)

  test('API 오류 시 에러를 던진다', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'))
    await expect(agent.evaluate(mockProject)).rejects.toThrow('Evaluation API call failed')
  }, 30000)

  test('유효하지 않은 JSON 응답 시 에러를 던진다', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '유효하지 않은 응답입니다.' }],
    })
    await expect(agent.evaluate(mockProject)).rejects.toThrow('유효한 스코어카드')
  }, 30000)

  test('G3 과제도 평가할 수 있다', async () => {
    const mockScoreCard = {
      impactScore: 15,
      roiScore: 10,
      confidentialityScore: 3,
      difficultyScore: 5,
      readinessScore: 6,
      strategyScore: 8,
      evaluationRationale: 'G3 고기밀 과제로 제한적 활용 가능.',
    }

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(mockScoreCard) }],
    })

    const result = await agent.evaluate(mockG3Project)
    expect(result.totalScore).toBe(
      result.impactScore + result.roiScore + result.confidentialityScore +
      result.difficultyScore + result.readinessScore + result.strategyScore
    )
  }, 30000)
})
