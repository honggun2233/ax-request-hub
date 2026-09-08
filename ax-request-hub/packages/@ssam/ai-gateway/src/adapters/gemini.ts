import { BedrockAdapter } from './bedrock'
import type { AIRequest, AIResponse } from '../types'

// GEMINI_BACKEND=bedrock_gemma (기본) | vertex_gemini
// 현재는 bedrock_gemma만 구현. vertex_gemini는 TODO.
export class GeminiAdapter extends BedrockAdapter {
  constructor() {
    // Bedrock에서 Google의 오픈웨이트 모델 Gemma
    super(process.env.GEMINI_MODEL_ID ?? 'google.gemma-2-27b-it-v1:0')
  }

  readonly provider = 'gemini' as const

  async complete(req: AIRequest): Promise<AIResponse> {
    const result = await super.complete(req)
    return { ...result, provider: 'gemini' }
  }
}
