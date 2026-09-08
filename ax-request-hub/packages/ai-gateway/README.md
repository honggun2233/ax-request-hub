# @ssam/ai-gateway

AX Hub 내부용 AI Gateway 독립 패키지. 다수의 LLM 프로바이더를 단일 인터페이스로 추상화한다.

## 지원 Provider

| Provider    | 구현 방식                         | 환경변수                                                         |
|-------------|----------------------------------|------------------------------------------------------------------|
| `anthropic` | Anthropic API 직접 호출           | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_ID`                        |
| `openai`    | Bedrock 경유 (Claude 폴백)        | `OPENAI_MODEL_ID`, `BEDROCK_REGION`, `BEDROCK_ACCESS_KEY_REF`, `BEDROCK_SECRET_KEY_REF` |
| `gemini`    | Bedrock 경유 (Gemma 모델)         | `GEMINI_MODEL_ID`, `BEDROCK_REGION`, `BEDROCK_ACCESS_KEY_REF`, `BEDROCK_SECRET_KEY_REF` |
| `onprem`    | OpenAI 호환 온프렘 (Ollama/vLLM)  | `ONPREM_LLM_BASE_URL`, `ONPREM_MODEL`, `ONPREM_LLM_API_KEY`     |

## 환경변수 명세

### 공통
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DEFAULT_AI_PROVIDER` | `anthropic` | 기본 프로바이더 (`anthropic`\|`openai`\|`gemini`\|`onprem`) |

### Anthropic (직접 API)
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `ANTHROPIC_API_KEY` | — | Anthropic API 키 (필수) |
| `ANTHROPIC_MODEL_ID` | `claude-haiku-4-5-20251001` | 사용할 Claude 모델 ID |

### AWS Bedrock (OpenAI·Gemini 공용)
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `BEDROCK_REGION` | `ap-northeast-2` | AWS 리전 |
| `BEDROCK_ACCESS_KEY_REF` | — | AWS Access Key ID (필수) |
| `BEDROCK_SECRET_KEY_REF` | — | AWS Secret Access Key (필수) |
| `OPENAI_MODEL_ID` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Bedrock 경유 모델 ID |
| `GEMINI_MODEL_ID` | `google.gemma-2-27b-it-v1:0` | Bedrock 경유 Gemma 모델 ID |

### OnPrem (Ollama / vLLM)
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `ONPREM_LLM_BASE_URL` | — | 온프렘 서버 URL (필수, 예: `http://localhost:11434`) |
| `ONPREM_MODEL` | `qwen3` | 실행 중인 모델명 |
| `ONPREM_LLM_API_KEY` | — | vLLM 보안 모드 시 설정 (Ollama 불필요) |

## 기본 사용법

```ts
import { gatewayComplete, getDefaultProvider } from '@ssam/ai-gateway'

// 기본 프로바이더로 완성
const response = await gatewayComplete({
  messages: [{ role: 'user', content: '안녕하세요!' }],
  maxTokens: 1024,
})

console.log(response.content)        // 응답 텍스트
console.log(response.totalTokens)    // 사용 토큰 수
console.log(response.provider)       // 실제 사용된 프로바이더

// 특정 프로바이더 지정
const onpremResponse = await gatewayComplete(
  { messages: [{ role: 'user', content: '작업을 분류해줘' }] },
  'onprem'
)
```

## 자동 라우팅 (routing.ts)

```ts
import { gatewayCompleteRouted } from '@ssam/ai-gateway'

// Qwen이 작업 성격을 분류하여 최적 프로바이더 선택
const response = await gatewayCompleteRouted(req, {
  taskSummary: '코드 리뷰 작업',
  taskType: 'CODE_REVIEW',
  projectId: 'proj-123',
  employeeId: 'emp-456',
})
```

> **참고**: `quota.ts`와 `routing.ts`는 앱 레벨의 Prisma DB(`@/lib/prisma`)와 Policy Gateway(`@/lib/gateway/policy`)에 의존합니다. 이 모듈들은 현재 AX Hub 모노레포 내에서만 동작합니다.

## 빌드

```bash
cd packages/ai-gateway
npm run build   # dist/ 생성
npm run dev     # watch 모드
```
