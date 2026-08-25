import { BedrockAdapter } from './bedrock'
import type { AIRequest, AIResponse } from '../types'

// Bedrock에서 GPT는 현재 미지원. Bedrock Claude로 폴백 처리.
export class OpenAIAdapter extends BedrockAdapter {
  constructor() {
    super(process.env.OPENAI_MODEL_ID ?? 'anthropic.claude-3-5-sonnet-20241022-v2:0')
  }

  readonly provider = 'openai' as const

  async complete(req: AIRequest): Promise<AIResponse> {
    const result = await super.complete(req)
    return { ...result, provider: 'openai' }
  }
}
