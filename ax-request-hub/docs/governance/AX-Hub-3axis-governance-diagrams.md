# AX Hub 거버넌스 다이어그램 — 3축 개요 + 축별 워크플로우

**작성일**: 2026-08-21

---

## 1페이지 — 거버넌스 개요

```mermaid
flowchart TD
    Hub["AX Hub<br/>온프렘 Qwen 기반 호스팅<br/>'판단하고 파악하는' 거버넌스 허브"]

    Hub --> Agent["① 에이전트 관리<br/>Gate1~3 · 라이프사이클 · KPI"]
    Hub --> Data["② 데이터 관리<br/>카탈로그 · 프로비저닝 · 영향도분석"]
    Hub --> Token["③ 토큰 관리<br/>A(엔터프라이즈)·B(자체엔진)·C(배포에이전트)"]

    Agent --> AgentSelf["신청: 에이전트 등록 신청"]
    Agent --> AgentGov["거버넌스: 에이전트 거버넌스(AX_TEAM)"]

    Data --> DataSelf["신청: 데이터 신청"]
    Data --> DataGov["거버넌스: 데이터 거버넌스(DATA_PLATFORM)"]

    Token --> TokenA["A: 엔터프라이즈 앱 직접사용<br/>Pull 수집"]
    Token --> TokenB["B: Qwen판단 + Bedrock실행<br/>Push 자체기록"]
    Token --> TokenC["C: 배포에이전트 런타임<br/>Push 자체기록"]

    AgentGov -.영향도 질의B방향 예정.-> Data
    DataGov -.영향도 질의A방향.-> Agent
    Token -.비용 데이터 반영.-> Agent
    Token -.비용 데이터 반영.-> Data
```

**세 축의 관계**: 에이전트와 데이터는 "신청(셀프서비스) → 거버넌스(심사)"라는 동일한 패턴을 공유하며, 영향도 질의 엔진으로 서로 연결된다(데이터 회수가 에이전트에 미치는 영향, 에이전트가 데이터에 의존하는 관계). 토큰은 세 트랙 모두 앞의 두 축을 가로질러 비용 데이터를 공급하는 관통 축이다.

---

## 2페이지 — 에이전트 관리 워크플로우

```mermaid
flowchart TD
    Start([등록 신청]) --> Channel{입력 채널}
    Channel -->|표준포맷| Tier0[Tier0 규칙기반]
    Channel -->|대화/파일| Tier1[Tier1 AI 구조화]
    Tier0 --> Review[검토 확인]
    Tier1 --> Review
    Review --> Submit[제출]

    Submit --> DataCheck{데이터 카탈로그 존재?}
    DataCheck -->|No| DataReq[신규 데이터 신청 - 데이터축으로]
    DataCheck -->|Yes| Gate1a[Gate1a 기본요건]
    DataReq --> Gate1a
    DataReq --> Gate1b[Gate1b 데이터분류]
    Gate1a --> Gate1Join{Gate1 완료}
    Gate1b --> Gate1Join
    Gate1Join --> Gate2[Gate2 기술표준 코드리뷰]
    Gate2 --> Gate3[Gate3 채점 근거생성]
    Gate3 --> ScoreCheck{임계점수?}
    ScoreCheck -->|Yes| AutoApprove[자동승인]
    ScoreCheck -->|No| Committee[위원회 심의]
    Committee --> GateFail[반려 처리]
    GateFail --> Appeal{이의제기?}
    Appeal -->|Yes| ReRoute[원인게이트 복귀]
    Appeal -->|No| Closed([종료])

    AutoApprove --> Deploy[AWS 랜딩존 배포]
    Committee -->|승인| Deploy
    Deploy --> Monitor[운영 모니터링 KPI 추적]
    Monitor --> RetireCheck{3개월 연속 60% 미달?}
    RetireCheck -->|Yes| RetireFlag[은퇴후보 자동플래그]
    RetireCheck -->|No| Monitor
```

---

## 3페이지 — 데이터 관리 워크플로우

```mermaid
flowchart TD
    Start([데이터 신청]) --> Catalog{카탈로그에 이미 있나?}
    Catalog -->|Yes| Provision[프로비저닝 승인]
    Catalog -->|No| NewAsset[신규 자산 등록]
    NewAsset --> Review[DP 심사 REQUESTED에서 REVIEWING SEC_REVIEW]
    Review --> Decision{승인?}
    Decision -->|Yes| Provision
    Decision -->|No| Rejected([반려])

    Provision --> Active[사용 중]
    Active --> RevokeIntent[회수 검토]

    RevokeIntent --> ImpactQuery[영향도 질의 A방향 신규 GET api graph impact]
    ImpactQuery --> Badge[영향받는 에이전트 N개 배지 표시 PRODUCTION 운영중 여부 포함]
    Badge --> Confirm{회수 확정?}
    Confirm -->|Yes| Revoke[회수 실행 연관 에이전트 SUSPENDED]
    Confirm -->|No| Active

    Revoke --> Log[AuditLog 기록]
```

---

## 4페이지 — 토큰 관리 워크플로우 (A/B/C 3트랙)

```mermaid
flowchart TD
    subgraph A["A트랙 - 엔터프라이즈 계정"]
        Employee[직원] -->|직접 사용| VendorApp["Claude GPT Gemini 앱"]
        VendorApp -.벤더 관리자 API.-> Pull["일 1회 배치 Pull"]
        Pull --> UsageDaily["UsageRecordDaily 에서 UsageRecord로"]
    end

    subgraph B["B트랙 - AX Hub 자체 엔진"]
        Task["인테이크 Gate2 Gate3 작업"] --> Qwen["Qwen 온프렘 판단만"]
        Qwen -->|벤더 추천| Bedrock["AWS Bedrock 경유 실행"]
        Bedrock --> GatewayLog["GatewayCallLog Push 자체기록"]
    end

    subgraph C["C트랙 - 배포 에이전트"]
        Agent["운영 중 에이전트"] -->|자체 AI 호출| AgentAI["AI 실행"]
        AgentAI --> ServiceToken["서비스토큰 인증"]
        ServiceToken --> RuntimeLog["AgentRuntimeUsage Push 자체기록"]
    end

    UsageDaily --> Dashboard["A B C 통합 비용 대시보드"]
    GatewayLog --> Dashboard
    RuntimeLog --> Dashboard
```

**참고**: A트랙은 Claude Enterprise Analytics API 키 발급(승인 1건)만 남으면 완결. B·C트랙은 코드 구현 완료.
