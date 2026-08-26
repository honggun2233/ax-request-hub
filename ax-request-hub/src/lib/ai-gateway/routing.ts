import { gatewayComplete } from './gateway'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { AIRequest, ProviderKey } from './types'

export type TaskType =
  | 'TIER1_PARSE'
  | 'CONSULTATION_CONTINUE'
  | 'GATE1_REVIEW'
  | 'GATE2_REVIEW'
  | 'GATE3_RATIONALE'
  | 'KPI_EVAL'
  | 'SYNTHESIZE'
  | 'GENERAL'

export interface ClassifyResult {
  vendor: 'claude' | 'gpt' | 'gemini'
  confidence: number  // 0-100
  reason: string
}

// Qwen이 작업 성격을 분류 (판단 전용 — 실행 안 함)
export async function classifyTask(taskSummary: string): Promise<ClassifyResult> {
  try {
    const response = await gatewayComplete({
      messages: [{
        role: 'user',
        content: `다음 AI 작업에 가장 적합한 모델을 판단하세요.\n\n작업: ${taskSummary}\n\n응답 형식(JSON만, 다른 텍스트 없이):\n{"vendor":"claude","confidence":85,"reason":"한 줄 이유"}\n\nvendor는 claude/gpt/gemini 중 하나만 사용.`
      }]
    }, 'onprem')  // Qwen 전용

    const parsed = JSON.parse(response.content.trim()) as ClassifyResult
    return parsed
  } catch {
    // 분류 실패 시 기본값 (claude) — 판단 실패가 실행을 막으면 안 됨
    return { vendor: 'claude', confidence: 0, reason: 'classification_failed' }
  }
}

// vendor 이름 → ProviderKey 매핑
function vendorToProvider(vendor: 'claude' | 'gpt' | 'gemini'): ProviderKey {
  const map: Record<string, ProviderKey> = {
    claude: 'anthropic',
    gpt: 'openai',
    gemini: 'gemini',
  }
  return map[vendor] ?? 'anthropic'
}

// 자동화 경로: classifyTask → Bedrock 실행 → GatewayCallLog 기록
export async function gatewayCompleteRouted(
  req: AIRequest,
  options: {
    taskSummary?: string   // Qwen에게 보낼 작업 설명 (없으면 분류 스킵)
    taskType?: TaskType
    projectId?: string
    employeeId?: string
    overrideProvider?: ProviderKey  // 수동 override 시
  } = {}
) {
  let provider: ProviderKey

  if (options.overrideProvider) {
    provider = options.overrideProvider
  } else if (options.taskSummary) {
    const classification = await classifyTask(options.taskSummary)
    provider = vendorToProvider(classification.vendor)
  } else {
    provider = 'anthropic'  // 분류 없이 직접 호출 시 기본값
  }

  const response = await gatewayComplete(req, provider)

  // GatewayCallLog 자동 기록
  await prisma.gatewayCallLog.create({
    data: {
      providerKey: provider,
      taskType: options.taskType ?? 'GENERAL',
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      totalTokens: response.totalTokens,
      costKrw: new Prisma.Decimal(estimateCostKrw(provider, response.totalTokens)),
      projectId: options.projectId,
      employeeId: options.employeeId,
    }
  }).catch(() => {})  // 로그 실패가 실제 응답을 막으면 안 됨

  return response
}

function estimateCostKrw(provider: ProviderKey, totalTokens: number): number {
  // 임시 단가 (원/1K 토큰) — 실제 계약 단가로 업데이트 필요
  const ratePerKToken: Record<string, number> = {
    anthropic: 15,
    openai: 15,
    gemini: 3,
    onprem: 0,  // 서버 고정비, 토큰당 0
  }
  const rate = ratePerKToken[provider] ?? 10
  return (totalTokens / 1000) * rate
}
