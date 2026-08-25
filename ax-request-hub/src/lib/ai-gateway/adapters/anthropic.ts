import { BedrockAdapter } from './bedrock'
import type { AIRequest, AIResponse } from '../types'

export class AnthropicAdapter extends BedrockAdapter {
  // Bedrock에서 Claude의 modelId 형식: anthropic.claude-3-5-sonnet-20241022-v2:0
  constructor() {
    super(process.env.ANTHROPIC_MODEL_ID ?? 'anthropic.claude-3-5-sonnet-20241022-v2:0')
  }

  readonly provider = 'anthropic' as const

  async complete(req: AIRequest): Promise<AIResponse> {
    const result = await super.complete(req)
    return { ...result, provider: 'anthropic' }
  }
}
