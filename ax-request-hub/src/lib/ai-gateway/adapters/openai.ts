import { AIProviderAdapter } from './base'
import type { AIRequest, AIResponse, ProviderConfig } from '../types'

export class OpenAIAdapter extends AIProviderAdapter {
  readonly provider = 'openai' as const
  readonly defaultModel = 'gpt-4o'

  constructor(config: ProviderConfig = {}) {
    const isAzure = !!(config.baseUrl ?? process.env.AZURE_OPENAI_ENDPOINT)
    super({
      apiKey: config.apiKey ?? (isAzure ? process.env.AZURE_OPENAI_KEY : process.env.OPENAI_API_KEY),
      baseUrl: config.baseUrl ?? (isAzure
        ? process.env.AZURE_OPENAI_ENDPOINT
        : 'https://api.openai.com'),
      deploymentName: config.deploymentName ?? process.env.AZURE_OPENAI_DEPLOYMENT,
      ...config,
    })
  }

  isConfigured() {
    return !!this.config.apiKey
  }

  private get isAzure() {
    return this.config.baseUrl?.includes('azure.com') ?? false
  }

  private get endpoint() {
    if (this.isAzure) {
      const deployment = this.config.deploymentName ?? this.defaultModel
      return `${this.config.baseUrl}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`
    }
    return `${this.config.baseUrl}/v1/chat/completions`
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    if (!this.config.apiKey) this.notConfigured()

    const model = req.model ?? (this.isAzure ? (this.config.deploymentName ?? this.defaultModel) : this.defaultModel)
    const body = {
      model,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    }
    if (this.isAzure) {
      headers['api-key'] = this.config.apiKey!
    } else {
      headers['authorization'] = `Bearer ${this.config.apiKey}`
    }

    const res = await fetch(this.endpoint, { method: 'POST', headers, body: JSON.stringify(body) })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI API error ${res.status}: ${err}`)
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
