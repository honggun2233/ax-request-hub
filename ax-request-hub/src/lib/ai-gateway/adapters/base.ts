import type { AIRequest, AIResponse, ProviderConfig, ProviderKey } from '../types'

export abstract class AIProviderAdapter {
  abstract readonly provider: ProviderKey
  abstract readonly defaultModel: string

  constructor(protected config: ProviderConfig) {}

  abstract isConfigured(): boolean
  abstract complete(req: AIRequest): Promise<AIResponse>

  protected notConfigured(): never {
    throw new Error(`[AIGateway] ${this.provider} API key not configured. Set env vars and restart.`)
  }
}
