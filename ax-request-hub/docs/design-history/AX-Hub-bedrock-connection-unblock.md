# AX Hub — Bedrock 연결방식 확정 + Gemini/Gemma 확인 우회 설계

**작성일**: 2026-08-21
**배경**: 구현 착수 전 확인사항 2가지 — 지금 확정 불가한 것은 재작업 없이 나중에 바꿀 수 있도록 설계로 우회

---

## 1. Bedrock 연결 방식 — AWS SDK 사용으로 확정 (판단 완료, 확인 불필요)

**결정**: raw fetch가 아니라 공식 SDK를 씁니다.

**이유**: Bedrock은 API 키가 아니라 AWS SigV4 서명 인증을 씁니다. 이걸 raw fetch로 직접 구현하면 서명 로직 자체에 버그가 생길 위험이 있고, 이미 AWS가 공식 SDK로 해결해놓은 문제를 다시 만드는 셈입니다. 이건 "선택지 중 뭐가 나을까"가 아니라 정답이 정해진 기술 문제라 확인 없이 진행합니다.

```
패키지: @aws-sdk/client-bedrock-runtime
사용: BedrockRuntimeClient + ConverseCommand (멀티턴/스트리밍 지원, InvokeModel보다 범용적)
```

**인증 방식**: AX Hub가 AWS 인프라 위(EC2/ECS)에 있는 게 아니라 온프렘 Qwen 서버에 있으므로 IAM 역할 기반 인증은 불가합니다. Access Key/Secret을 발급받아 시크릿 매니저에 저장하고 env로 주입합니다.

```env
BEDROCK_REGION=ap-northeast-2
BEDROCK_ACCESS_KEY_REF=vault://ax-hub/bedrock-access-key   # 원문 저장 금지, 이전에 정한 connectionRef 원칙 재사용
BEDROCK_SECRET_KEY_REF=vault://ax-hub/bedrock-secret-key
```

---

## 2. Gemini vs Gemma — 확정 전에도 막히지 않는 설계

**지금 확정할 필요가 없습니다.** 라우팅 로직·UI·override 흐름 어디에도 "Bedrock인지 Vertex AI인지"가 노출되지 않도록, 논리적 벤더 키(`gemini`)와 실제 백엔드 구현을 분리합니다.

```env
# 나중에 계약 조건 확인되면 이 값 하나만 바꾸면 끝
GEMINI_BACKEND=bedrock_gemma   # 또는 vertex_gemini
```

```ts
// gemini 어댑터 내부에서만 분기, 바깥(라우팅/분류/로그)은 전혀 모름
function getGeminiClient() {
  return process.env.GEMINI_BACKEND === 'vertex_gemini'
    ? createVertexAIClient()
    : createBedrockGemmaClient()
}
```

이러면 Qwen의 `classifyTask()`가 `"gemini"`를 추천하는 로직, `UsageEvent`에 `providerKey: 'gemini'`로 기록하는 로직, override UI에 "Gemini" 버튼이 뜨는 것 — 전부 백엔드가 뭐든 상관없이 그대로 작동합니다. 나중에 계약서 확인 후 env 값만 바꾸면 되고, 코드 재작성이 없습니다.

---

## 3. 진행 지시

위 두 가지를 확정된 전제로 간주하고, 이전 문서(`AX-Hub-ai-routing-final-architecture.md`) §8 개발 반영 가이드 그대로 착수합니다.

```
1. src/lib/ai-gateway/adapters/bedrock.ts 신규
   - @aws-sdk/client-bedrock-runtime 기반
   - BEDROCK_REGION, BEDROCK_ACCESS_KEY_REF, BEDROCK_SECRET_KEY_REF 사용

2. 기존 anthropic.ts / openai.ts / gemini.ts 어댑터를
   → 전부 bedrock.ts를 경유하도록 리팩터링
   (gemini.ts만 내부적으로 GEMINI_BACKEND 분기 추가)

3. src/lib/ai-gateway/routing.ts
   - classifyTask() 신규 (Qwen 호출, 판단 전용)
   - ModelProvider.costRank/qualityRank 필드 및 로직 제거
   - confidentialityLevel 기반 차단 로직 제거

4. AX팀 override UI
   - 자동화 경로(Tier1 파싱 등)와 수동 경로(Gate 심사 화면 "AI 보조 요청") 분리
   - 수동 경로에만 Qwen 추천 + override 버튼 노출

5. GatewayCallLog는 그대로 유지, Push 방식으로 매 Bedrock 호출 시 기록
```

---

## 4. 남은 확인사항 (착수를 막지 않음)

| 항목 | 상태 |
|---|---|
| Bedrock 연결 방식 | 해결됨 (SDK 사용 확정) |
| Gemini/Gemma 실제 계약 조건 | env 스위치로 우회, 나중에 1줄 수정으로 반영 가능 |
| Bedrock Access Key 발급 | 실제 착수 시 AWS 계정 관리자 확인 필요 (개발 착수 자체는 블로킹 안 됨 — 로컬은 Mock 어댑터로 개발 가능) |
