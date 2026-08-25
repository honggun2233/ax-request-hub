import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { AIProviderAdapter } from './base'
import type { AIRequest, AIResponse } from '../types'

// 환경변수:
// BEDROCK_REGION: 기본 ap-northeast-2
// BEDROCK_ACCESS_KEY_REF: Access Key
// BEDROCK_SECRET_KEY_REF: Secret Key

export class BedrockAdapter extends AIProviderAdapter {
  readonly provider = 'bedrock' as const
  readonly defaultModel: string

  private client: BedrockRuntimeClient | null = null

  constructor(defaultModel: string) {
    super({})
    this.defaultModel = defaultModel
  }

  isConfigured(): boolean {
    return !!(process.env.BEDROCK_REGION && process.env.BEDROCK_ACCESS_KEY_REF)
  }

  private getClient(): BedrockRuntimeClient {
    if (!this.client) {
      this.client = new BedrockRuntimeClient({
        region: process.env.BEDROCK_REGION ?? 'ap-northeast-2',
        credentials: {
          accessKeyId: process.env.BEDROCK_ACCESS_KEY_REF ?? '',
          secretAccessKey: process.env.BEDROCK_SECRET_KEY_REF ?? '',
        },
      })
    }
    return this.client
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    if (!this.isConfigured()) this.notConfigured()
    const model = req.model ?? this.defaultModel
    const client = this.getClient()

    const cmd = new ConverseCommand({
      modelId: model,
      messages: req.messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: [{ text: m.content }] })),
      system: req.messages.filter(m => m.role === 'system').map(m => ({ text: m.content })),
      inferenceConfig: {
        maxTokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
      },
    })

    const res = await client.send(cmd)
    const content = res.output?.message?.content?.[0]?.text ?? ''
    const inputTokens = res.usage?.inputTokens ?? 0
    const outputTokens = res.usage?.outputTokens ?? 0

    return {
      content,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      model,
      provider: 'bedrock' as any,
    }
  }
}
