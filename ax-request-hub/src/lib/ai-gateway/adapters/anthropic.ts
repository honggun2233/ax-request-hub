import { AIProviderAdapter } from './base'
import type { AIRequest, AIResponse, ProviderConfig } from '../types'

export class AnthropicAdapter extends AIProviderAdapter {
  readonly provider = 'anthropic' as const
  readonly defaultModel = 'claude-sonnet-4-6'

  constructor(config: ProviderConfig = {}) {
    super({
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
      baseUrl: config.baseUrl ?? 'https://api.anthropic.com',
      ...config,
    })
  }

  isConfigured() {
    return !!this.config.apiKey
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    if (!this.config.apiKey) this.notConfigured()

    const model = req.model ?? this.defaultModel
    const body = {
      model,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
      messages: req.messages.filter(m => m.role !== 'system'),
      ...(req.messages.find(m => m.role === 'system') && {
        system: req.messages.find(m => m.role === 'system')!.content,
      }),
    }

    const res = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic API error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const inputTokens = data.usage?.input_tokens ?? 0
    const outputTokens = data.usage?.output_tokens ?? 0

    return {
      content: data.content?.[0]?.text ?? '',
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      model,
      provider: this.provider,
    }
  }
}
