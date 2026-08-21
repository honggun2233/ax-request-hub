import { AIProviderAdapter } from './base'
import type { AIRequest, AIResponse } from '../types'

// Ollama / vLLM / 기타 OpenAI 호환 온프렘 LLM 어댑터
// ONPREM_LLM_BASE_URL: Ollama = http://localhost:11434, vLLM = http://localhost:8000
// ONPREM_MODEL: 실행 중인 모델명 (예: qwen3:27b, qwen3.6-27b)
// ONPREM_LLM_API_KEY: vLLM 보안 모드 시 설정. Ollama는 불필요.
export class OnpremAdapter extends AIProviderAdapter {
  readonly provider = 'onprem' as const
  readonly defaultModel = process.env.ONPREM_MODEL ?? 'qwen3'

  constructor() {
    super({
      baseUrl: process.env.ONPREM_LLM_BASE_URL,
      apiKey: process.env.ONPREM_LLM_API_KEY,
    })
  }

  isConfigured() {
    return !!this.config.baseUrl
  }

  private get endpoint() {
    return `${this.config.baseUrl}/v1/chat/completions`
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    if (!this.config.baseUrl) this.notConfigured()

    const model = req.model ?? (process.env.ONPREM_MODEL ?? this.defaultModel)
    const body = {
      model,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
    }

    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (this.config.apiKey) {
      headers['authorization'] = `Bearer ${this.config.apiKey}`
    }

    const res = await fetch(this.endpoint, { method: 'POST', headers, body: JSON.stringify(body) })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Onprem LLM API error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const inputTokens = data.usage?.prompt_tokens ?? 0
    const outputTokens = data.usage?.completion_tokens ?? 0

    return {
      content: data.choices?.[0]?.message?.content ?? '',
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      model,
      provider: this.provider,
    }
  }
}
