import { AIProviderAdapter } from './base'
import type { AIRequest, AIResponse } from '../types'

// 직접 Anthropic API 호출 (Bedrock 경유 아님)
// 환경변수: ANTHROPIC_API_KEY
export class AnthropicAdapter extends AIProviderAdapter {
  readonly provider = 'anthropic' as const
  readonly defaultModel: string

  constructor() {
    super({})
    this.defaultModel = process.env.ANTHROPIC_MODEL_ID ?? 'claude-haiku-4-5-20251001'
  }

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    if (!this.isConfigured()) this.notConfigured()

    const model = req.model ?? this.defaultModel
    const systemMessages = req.messages.filter(m => m.role === 'system')
    const userMessages = req.messages.filter(m => m.role !== 'system')

    const body: Record<string, unknown> = {
      model,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
    }

    if (systemMessages.length > 0) {
      body.system = systemMessages.map(m => m.content).join('\n')
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`[AnthropicAdapter] API error ${res.status}: ${err}`)
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>
      usage: { input_tokens: number; output_tokens: number }
      model: string
    }

    const content = data.content.find(c => c.type === 'text')?.text ?? ''
    const inputTokens = data.usage?.input_tokens ?? 0
    const outputTokens = data.usage?.output_tokens ?? 0

    return {
      content,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      model: data.model ?? model,
      provider: 'anthropic',
    }
  }
}
