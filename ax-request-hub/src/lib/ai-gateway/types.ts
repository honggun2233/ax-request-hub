export type ProviderKey = 'anthropic' | 'openai' | 'gemini'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIRequest {
  messages: AIMessage[]
  model?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface AIResponse {
  content: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  provider: ProviderKey
}

export interface QuotaCheckResult {
  allowed: boolean
  used: number
  limit: number
  remaining: number
  pct: number
}

export interface ProviderConfig {
  apiKey?: string
  baseUrl?: string
  region?: string
  deploymentName?: string // Azure OpenAI
}
