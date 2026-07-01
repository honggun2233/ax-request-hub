import { anthropic, MODEL } from '@/src/lib/claude'
import { ExtractedProject } from '@/src/lib/agents/consultation'

export interface ScoreCardResult {
  impactScore: number        // 0-25
  roiScore: number           // 0-25
  confidentialityScore: number // 0-15
  difficultyScore: number    // 0-15 (낮을수록 쉬울수록 고배점)
  readinessScore: number     // 0-10
  strategyScore: number      // 0-10
  totalScore: number
  evaluationRationale: string
}

const EVAL_SYSTEM = `당신은 삼성자산운용 AX/PI팀의 AI 과제 평가 전문가입니다.
다음 6가지 차원으로 과제를 평가하고 점수를 JSON으로 출력하세요.

차원별 배점:
- impactScore: 0-25 (영향 인원수·업무빈도·전략정합성)
- roiScore: 0-25 (시간절감·비용절감·수익기여)
- confidentialityScore: G1=15, G2=10, G3=3
- difficultyScore: 0-15 (낮을수록 쉬운 과제, 빠른 win 우선)
- readinessScore: 0-10 (데이터가용성·챔피언유무·As-Is명확도)
- strategyScore: 0-10 (AX 청사진 등대과제·100일 로드맵 정합성)

반드시 이 JSON 형식으로만 응답하세요:
{
  "impactScore": <number>,
  "roiScore": <number>,
  "confidentialityScore": <number>,
  "difficultyScore": <number>,
  "readinessScore": <number>,
  "strategyScore": <number>,
  "evaluationRationale": "<200자 이내 평가 근거>"
}`

export class EvaluationAgent {
  async evaluate(project: ExtractedProject): Promise<ScoreCardResult> {
    const userMessage = `과제 정보:
제목: ${project.title}
부서: ${project.department}
설명: ${project.description}
As-Is: ${project.asIs}
기대효익: ${project.expectedBenefit}
기밀등급: ${project.confidentialityLevel}
예상사용자: ${project.estimatedUsers}명
챔피언: ${project.championName ?? '미정'}`

    let raw: string
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 600,
        system: EVAL_SYSTEM,
        messages: [{ role: 'user', content: userMessage }],
      })
      raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
    } catch (err) {
      throw new Error(`Evaluation API call failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    const parsed = this.parseScoreCard(raw)
    if (!parsed) {
      throw new Error('평가 에이전트가 유효한 스코어카드를 반환하지 않았습니다.')
    }
    return parsed
  }

  private parseScoreCard(text: string): ScoreCardResult | null {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      const obj = JSON.parse(jsonMatch[0])
      const scores = {
        impactScore: Number(obj.impactScore),
        roiScore: Number(obj.roiScore),
        confidentialityScore: Number(obj.confidentialityScore),
        difficultyScore: Number(obj.difficultyScore),
        readinessScore: Number(obj.readinessScore),
        strategyScore: Number(obj.strategyScore),
        evaluationRationale: String(obj.evaluationRationale ?? ''),
      }
      // validate ranges (also rejects NaN via Number.isFinite)
      const isValidScore = (v: number, max: number) => Number.isFinite(v) && v >= 0 && v <= max

      if (
        !isValidScore(scores.impactScore, 25) ||
        !isValidScore(scores.roiScore, 25) ||
        !isValidScore(scores.confidentialityScore, 15) ||
        !isValidScore(scores.difficultyScore, 15) ||
        !isValidScore(scores.readinessScore, 10) ||
        !isValidScore(scores.strategyScore, 10)
      ) {
        console.warn('Score out of range or NaN in evaluation result:', scores)
        return null
      }
      const totalScore =
        scores.impactScore + scores.roiScore + scores.confidentialityScore +
        scores.difficultyScore + scores.readinessScore + scores.strategyScore
      return { ...scores, totalScore }
    } catch (err) {
      console.warn('Failed to parse evaluation response:', err)
      return null
    }
  }
}
