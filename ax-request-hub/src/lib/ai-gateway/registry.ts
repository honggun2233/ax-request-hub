import { AnthropicAdapter } from './adapters/anthropic'
import { OpenAIAdapter } from './adapters/openai'
import { GeminiAdapter } from './adapters/gemini'
import type { AIProviderAdapter } from './adapters/base'
import type { ProviderKey } from './types'

const adapters: Record<ProviderKey, AIProviderAdapter> = {
  anthropic: new AnthropicAdapter(),
  openai: new OpenAIAdapter(),
  gemini: new GeminiAdapter(),
}

export function getAdapter(provider: ProviderKey): AIProviderAdapter {
  const adapter = adapters[provider]
  if (!adapter) throw new Error(`Unknown provider: ${provider}`)
  return adapter
}

export function getProviderStatus(): Record<ProviderKey, boolean> {
  return {
    anthropic: adapters.anthropic.isConfigured(),
    openai: adapters.openai.isConfigured(),
    gemini: adapters.gemini.isConfigured(),
  }
}

export const VALID_PROVIDERS: ProviderKey[] = ['anthropic', 'openai', 'gemini']
