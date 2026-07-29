# Scripts

## collect-llm-usage.ts — LLM 사용량 수집

매일 전일 데이터를 OpenAI/Gemini API에서 수집해 UsageRecord에 저장한다.

### 수동 실행

```bash
npm run collect-usage
```

### 환경변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `OPENAI_API_KEY` | OpenAI organization-level API key | OpenAI 수집 시 필수 |
| `OPENAI_ORG_ID` | OpenAI organization ID | 선택 (멀티 조직 구분) |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID (Gemini용, 현재 미구현) | - |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCP service account JSON 경로 (Gemini용, 현재 미구현) | - |

### 동작 설명

1. `SYSTEM` employee(`system@ax-hub.internal`)가 없으면 자동 upsert
2. OpenAI organization usage completions API로 전일 입력+출력 토큰 합산
3. `UsageRecord`에 `service='ChatGPT'`, `yearMonth='YYYY-MM'`으로 upsert
4. Gemini는 `GOOGLE_APPLICATION_CREDENTIALS` 미설정 시 warn 후 건너뜀 (추후 구현)

### 주의

- 실제 API 키를 코드에 하드코딩하지 않는다
- `.env` 파일은 git에 커밋하지 않는다
