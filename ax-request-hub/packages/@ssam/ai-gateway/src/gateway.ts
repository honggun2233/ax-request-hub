import { getAdapter, VALID_PROVIDERS } from './registry'
import type { ProviderKey, AIRequest, AIResponse } from './types'

// DEFAULT_AI_PROVIDER 환경변수로 전체 에이전트의 기본 provider를 전환
// 예: anthropic(기본) → onprem(Qwen 배포 후)
export function getDefaultProvider(): ProviderKey {
  const p = process.env.DEFAULT_AI_PROVIDER as ProviderKey
  if (p && (VALID_PROVIDERS as string[]).includes(p)) return p
  return 'anthropic'
}

export async function gatewayComplete(
  req: AIRequest,
  provider?: ProviderKey,
): Promise<AIResponse> {
  const p = provider ?? getDefaultProvider()
  return getAdapter(p).complete(req)
}
