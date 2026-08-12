import { AIProviderAdapter } from './base'
import type { AIRequest, AIResponse, ProviderConfig } from '../types'

export class GeminiAdapter extends AIProviderAdapter {
  readonly provider = 'gemini' as const
  readonly defaultModel = 'gemini-1.5-pro'

  constructor(config: ProviderConfig = {}) {
    super({
      apiKey: config.apiKey ?? process.env.GEMINI_API_KEY,
      baseUrl: config.baseUrl ?? 'https://generativelanguage.googleapis.com',
      ...config,
    })
  }

  isConfigured() {
    return !!this.config.apiKey
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    if (!this.config.apiKey) this.notConfigured()

    const model = req.model ?? this.defaultModel
    const systemMsg = req.messages.find(m => m.role === 'system')?.content

    const contents = req.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
      },
    }
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg }] }
    }

    const url = `${this.config.baseUrl}/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      model,
      provider: this.provider,
    }
  }
}
