import { anthropic, MODEL } from '@/src/lib/claude'

export interface ExtractedProject {
  title: string
  department: string
  requesterName: string
  requesterEmail: string
  description: string
  asIs: string
  expectedBenefit: string
  confidentialityLevel: 'G1' | 'G2' | 'G3'
  championName: string | null
  estimatedUsers: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentResponse {
  message: string
  isComplete: boolean
  extracted: ExtractedProject | null
}

const SYSTEM_PROMPT = `당신은 삼성자산운용 AX/PI팀의 AI 활용 신청 접수 담당자입니다.
현업 부서 직원이 AI 활용 아이디어를 설명하면, 아래 7가지 항목을 자연스러운 대화로 수집하세요.

수집 항목:
1. AI 활용명 (AI가 제안)
2. 신청 부서 / 담당자 이름 / 이메일
3. 현재 업무 방식 (As-Is)
4. 기대 효익 (시간절감/비용절감/품질향상)
5. 관련 데이터 기밀등급 (G1=공개정보, G2=대외비, G3=기밀(극비) — 고객PI·운용포지션·미공개투자정보 포함)
6. 예상 사용자 수
7. 내부 챔피언(이 AI 활용을 책임질 담당자) 이름

모든 항목이 수집되면 응답 끝에 다음 JSON 블록을 추가하세요:
<EXTRACTED>
{"title":"...","department":"...","requesterName":"...","requesterEmail":"...","description":"...","asIs":"...","expectedBenefit":"...","confidentialityLevel":"G1","championName":"...","estimatedUsers":0}
</EXTRACTED>

항목이 불명확하면 계속 질문하세요. 한 번에 하나씩 물어보세요. 친절하고 간결하게 응답하세요.`

export class ConsultationAgent {
  async start(): Promise<AgentResponse> {
    let response
    try {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: '안녕하세요, AI 활용 신청을 시작하고 싶습니다.',
          },
        ],
      })
    } catch (err) {
      throw new Error(`ConsultationAgent.start() API 호출 실패: ${err}`)
    }

    const message = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return { message, isComplete: false, extracted: null }
  }

  async continueChat(messages: ChatMessage[]): Promise<AgentResponse> {
    let response
    try {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages,
      })
    } catch (err) {
      throw new Error(`ConsultationAgent.continueChat() API 호출 실패: ${err}`)
    }

    const message = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const extracted = this.parseExtracted(message)

    return {
      message: message.replace(/<EXTRACTED>[\s\S]*?<\/EXTRACTED>/g, '').trim(),
      isComplete: extracted !== null,
      extracted,
    }
  }

  private parseExtracted(text: string): ExtractedProject | null {
    const match = text.match(/<EXTRACTED>([\s\S]*?)<\/EXTRACTED>/)
    if (!match) return null
    try {
      const VALID_LEVELS = ['G1', 'G2', 'G3'] as const
      const parsed = JSON.parse(match[1].trim()) as ExtractedProject
      if (!VALID_LEVELS.includes(parsed.confidentialityLevel as any)) {
        console.warn('Invalid confidentialityLevel:', parsed.confidentialityLevel)
        return null
      }
      return parsed
    } catch (err) {
      console.warn('Failed to parse EXTRACTED block:', err)
      return null
    }
  }
}
