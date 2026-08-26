# AX Hub 전체 워크플로우 — 현황 다이어그램 + 끊긴 지점 체크리스트

**작성일**: 2026-08-21
**목적**: 지금까지 확정된 모든 요소(인증·인테이크·Gate심사·B/C트랙·A트랙)를 하나로 합쳐 끊기거나 꼬인 지점을 점검

---

## 1. 통합 다이어그램

```mermaid
flowchart TD
    subgraph AUTH["인증 레이어 (middleware.ts) — 미해결, 모든 걸 관통"]
        SessionAuth[사람 세션 인증<br/>NextAuth]
        ServiceAuth[서비스토큰 인증<br/>아직 없음]
    end

    subgraph UTIL["활용 영역 — 인테이크"]
        Channel{입력 채널}
        Channel -->|표준포맷| Tier0[Tier0: 규칙기반]
        Channel -->|대화/파일| Synth["intake/synthesize<br/>AI호출 지점"]
        Tier0 --> Draft[초안 생성]
        Synth --> Draft
    end

    Draft -.세션인증 필요.-> SessionAuth
    SessionAuth --> Submit[신청 제출]

    subgraph CTRL["통제 영역 — Gate 심사"]
        Submit --> DataCheck{데이터 카탈로그 존재?}
        DataCheck -->|No| DataReq[신규 데이터 신청]
        DataCheck -->|Yes| Gate1a[Gate1a 심사]
        DataReq --> Gate1a
        DataReq --> Gate1b[Gate1b 심사]
        Gate1a --> Gate1Join{Gate1Join}
        Gate1b --> Gate1Join
        Gate1Join --> Gate2["Gate2: 코드리뷰<br/>AI호출 지점"]
        Gate2 --> Gate3["Gate3: 채점+근거생성<br/>AI호출 지점"]
        Gate3 --> ScoreCheck{임계점수?}
        ScoreCheck -->|Yes| AutoApprove[자동승인]
        ScoreCheck -->|No| Committee[위원회 심의]
        Committee --> GateFail[GateFail 공통처리]
        GateFail --> AppealCheck{이의제기?}
        AppealCheck -->|Yes| ReRoute[원인게이트 복귀]
        AppealCheck -->|No| Closed[REJECTED]
    end

    subgraph BTRACK["B트랙 실행엔진"]
        Router["Qwen 온프렘<br/>판단만 — 실행 안 함"]
        OldCode["동결됨<br/>ModelProvider/costRank<br/>selectProvider() 구코드"]
        Bedrock["AWS Bedrock<br/>Claude/GPT/Gemini 실제 실행"]
        Router -.추천.-> Bedrock
        OldCode -.혹시 아직 이걸 부르는 중?.-> Bedrock
    end

    Synth -.호출.-> BTRACK
    Gate2 -.호출.-> BTRACK
    Gate3 -.호출.-> BTRACK
    Bedrock --> UsageEventB["UsageEvent(B트랙)<br/>Push 자체기록"]

    AutoApprove --> Deploy
    ReRoute --> Gate1a
    ReRoute --> Gate1b
    ReRoute --> Gate2
    ReRoute --> Gate3

    subgraph DEPLOY["AWS 랜딩존 샌드박스"]
        Deploy[배포 실행] --> AgentRun["운영 중인 에이전트"]
        AgentRun -.자기사용량 보고.-> ServiceAuth
    end
    ServiceAuth -.차단중.-> UsageEventC["UsageEvent(C트랙)<br/>착수 불가"]

    subgraph ATRACK["A트랙 — 별도 흐름"]
        VendorAPI["Claude/GPT/Gemini<br/>관리자 API"] -->|일1회 배치 Pull| UsageRecord["UsageRecordDaily → UsageRecord"]
    end
```

---

## 2. 끊기거나 꼬인 부분 점검

| # | 지점 | 상태 | 설명 |
|---|---|---|---|
| 1 | `intake/synthesize`·Gate2·Gate3가 지금 어느 코드를 부르는지 | 🔴 미확인 | 동결된 구코드(`selectProvider`)로 연결돼 있으면 B트랙 재설계 시 다시 끊어야 함. 인테이크 재개 작업이 지금 이 지점을 지나는 중이라 가장 시급 |
| 2 | 세션인증(사람) → 서비스토큰인증(에이전트) | 🔴 끊어짐 | `middleware.ts`가 사람 세션만 다뤄서 C트랙 전체가 이 지점에서 막혀 있음 |
| 3 | Gate1Join의 AND/단독 조건 | ✅ 명세됨 | v7에서 설계 완료, 실제 코드 반영 여부만 확인 필요 |
| 4 | GateFail → 이의제기 → 원인게이트 복귀 | ✅ 설계 완료 | v8~v9에서 설계, 실제 코드 반영 여부는 별도 확인 필요 |
| 5 | Agent ↔ AgentRegistry (`agentRegistryId`) | 🟠 불확실 | "자동 세팅 코드가 실제로 있는지" 확인 요청이 아직 답변 안 됨. KPI/은퇴판정 흐름에 계속 걸려있는 문제 |
| 6 | A트랙 → B/C트랙 | ✅ 의도적 분리 | 서로 다른 흐름이라 맞는 설계, 끊긴 게 아니라 원래 분리된 것 |
| 7 | dp/requests의 "나머지 전환" 구형 PATCH 사용 여부 | 🟡 미확인 | 예전에 확인 요청했으나 이후 문서에서 언급 없음 |

---

## 3. 우선순위

| 항목 | 우선순위 |
|---|---|
| #1 — 인테이크/Gate2/Gate3의 AI 호출부가 구코드를 부르는지 확인 | ★★★ 즉시 (진행 중인 작업과 직결) |
| #2 — middleware.ts 서비스토큰 | ★★★ 즉시 |
| #5 — agentRegistryId 자동세팅 여부 재확인 | ★★ |
| #7 — dp/requests 잔여 전환 확인 | ★ |
