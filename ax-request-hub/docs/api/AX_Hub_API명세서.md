# AX Hub — API 명세서

| 항목 | 내용 |
|------|------|
| 문서번호 | AX-API-2026-001 |
| 버전 | v1.0 |
| 작성일 | 2026-07-29 |
| Base URL | `http://localhost:3005` (온프레미스 배포 후 사내 도메인으로 변경) |

---

## 공통 규칙

### 인증
모든 API는 NextAuth.js 세션 쿠키 기반 인증. 미인증 시 `401 Unauthorized` 반환.

### 역할 접근 제어
| 역할 | 코드 |
|------|------|
| 일반 직원 | `EMPLOYEE` |
| 부서장 | `DEPT_HEAD` |
| AX팀 | `AX_TEAM` |
| 데이터플랫폼팀 | `DATA_PLATFORM` |
| 경영진 | `EXECUTIVE` |

### 응답 형식
- 성공: `200 OK` 또는 `201 Created`, JSON body
- 실패: `4xx` / `5xx`, `{ "error": "메시지" }` 형식

---

## 1. 과제 관리

### `GET /api/projects`
과제 목록 조회.

**권한**: 전체 직원 (EMPLOYEE 이상). AX_TEAM/EXECUTIVE는 전사 조회.

**Query**:
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `mine` | `"1"` | 내 과제만 필터 |

**응답 (200)**:
```json
[
  {
    "id": "clxxx",
    "title": "업무 자동화 에이전트",
    "status": "APPROVED",
    "requesterEmail": "user@samsung.com",
    "scoreCard": { "totalScore": 75, ... },
    "agent": { "devStage": "GATE1", "prodStatus": null },
    "pendingAppeal": false,
    "createdAt": "2026-07-01T00:00:00.000Z"
  }
]
```

---

### `POST /api/projects`
과제 신청.

**권한**: 전체 직원

**Body**:
```json
{
  "title": "업무 자동화 에이전트",
  "problemDescription": "반복 보고서 작성 자동화",
  "expectedEffect": "주당 4시간 절감",
  "aiModel": "Claude",
  "dataRequired": true,
  "classification": "G2",
  "gateCheckItems": ["기술표준1", "기술표준2"]
}
```

**응답 (201)**: 생성된 Project 객체

---

### `GET /api/projects/[id]`
과제 상세 조회.

**권한**: 과제 신청자 + AX_TEAM

---

### `PATCH /api/projects/[id]`
과제 정보 수정.

**권한**: AX_TEAM

---

### `POST /api/projects/[id]/appeal`
과제 반려에 대한 이의신청.

**권한**: 과제 신청자

**Body**:
```json
{ "reason": "이의신청 사유" }
```

---

### `POST /api/evaluate/[id]`
Claude API로 과제 자동 스코어링 실행.

**권한**: AX_TEAM

**응답 (200)**:
```json
{
  "totalScore": 75,
  "dimensions": {
    "feasibility": 80,
    "impact": 70,
    "dataReadiness": 65,
    "riskLevel": 85,
    "compliance": 90,
    "innovation": 60
  }
}
```

---

### `POST /api/approve/[id]`
과제 승인 또는 반려.

**권한**: AX_TEAM

**Body**:
```json
{
  "action": "APPROVE",
  "comment": "승인 사유"
}
```
`action`: `"APPROVE"` | `"REJECT"`

---

## 2. 에이전트 레지스트리

### `GET /api/admin/agents`
에이전트(AgentRegistry) 전체 목록.

**권한**: AX_TEAM

**응답 (200)**: AgentRegistry 배열

---

### `POST /api/admin/agents`
에이전트 등록.

**권한**: AX_TEAM

**Body**:
```json
{
  "name": "보고서 요약 에이전트",
  "department": "리서치팀",
  "description": "일일 리포트 자동 요약",
  "kpiName": "보고서 처리 건수",
  "kpiTarget": 100,
  "kpiType": "COUNT",
  "kpiMeasureMethod": "시스템 로그",
  "kpiMeasureCycle": "MONTHLY"
}
```

---

### `POST /api/admin/agents/[id]/kpi-record`
에이전트 KPI 실적 기록.

**권한**: AX_TEAM

**Body**:
```json
{ "value": 85, "period": "2026-07" }
```

---

### `PATCH /api/admin/agents/[id]/last-used`
에이전트 최근 사용 시각 갱신.

**권한**: AX_TEAM

---

### `GET /api/admin/agents/flags`
에이전트 플래그 목록 (SUSPENDED 등).

**권한**: AX_TEAM

---

### `GET /api/registry`
레지스트리 파이프라인 뷰 데이터 (프론트용 집계).

**권한**: EMPLOYEE 이상 (AX_TEAM은 전체, 나머지는 제한)

---

### `POST /api/registry/links`
에이전트-AX프로젝트 연결 (M:N).

**권한**: AX_TEAM

**Body**:
```json
{ "agentId": "clxxx", "axProjectId": "clyyy" }
```

---

### `GET /api/agents/[id]/artifacts`
에이전트 산출물 목록.

**권한**: AX_TEAM

---

### `POST /api/agents/[id]/artifacts`
에이전트 산출물 등록.

**권한**: AX_TEAM

---

### `POST /api/agents/[id]/deprecate`
에이전트를 DEPRECATED 상태로 전환.

**권한**: AX_TEAM

---

### `POST /api/agents/[id]/retire`
에이전트를 RETIRED 상태로 전환.

**권한**: AX_TEAM

---

### `GET /api/agents/[id]/knowledge`
에이전트 지식 추출 내용 조회.

**권한**: AX_TEAM

---

### `GET /api/agents/retired`
퇴역 에이전트 목록.

**권한**: AX_TEAM

---

## 3. 데이터 프로비저닝

### `GET /api/data/assets`
데이터 카탈로그 자산 목록.

**권한**: EMPLOYEE 이상

**Query**:
| 파라미터 | 설명 |
|----------|------|
| `q` | 키워드 검색 |
| `classification` | `G1` / `G2` / `G3` |
| `sourceSystem` | `INTERNAL` / `SNOWFLAKE` |

---

### `POST /api/data/assets`
데이터 자산 등록.

**권한**: DATA_PLATFORM, AX_TEAM

**Body**:
```json
{
  "name": "고객 트랜잭션 데이터",
  "description": "ETF 거래 내역",
  "classification": "G3",
  "owner": "데이터플랫폼팀",
  "sourceSystem": "SNOWFLAKE",
  "snowflakeDb": "PROD_DB",
  "snowflakeSchema": "PUBLIC"
}
```

---

### `GET /api/data/assets/[id]`
데이터 자산 상세.

**권한**: EMPLOYEE 이상

---

### `PATCH /api/data/assets/[id]`
데이터 자산 수정.

**권한**: DATA_PLATFORM, AX_TEAM

---

### `GET /api/data/requests`
데이터 요청 목록.

**권한**: EMPLOYEE (내 요청만), DATA_PLATFORM/AX_TEAM (전체)

**Query**:
| 파라미터 | 설명 |
|----------|------|
| `status` | `PENDING` / `APPROVED` / `REJECTED` / `PROVISIONED` |

---

### `POST /api/data/requests`
데이터 이용 신청.

**권한**: EMPLOYEE 이상

**Body**:
```json
{
  "type": "ACCESS",
  "assetId": "clxxx",
  "projectId": "clyyy",
  "purpose": "ETF 성과 분석",
  "classification": "G2",
  "periodMonths": 6,
  "forProduction": false
}
```
`type`: `"ACCESS"` (기존 자산 이용) | `"NEW"` (신규 수집 요청)

---

### `PATCH /api/data/requests/[id]`
데이터 요청 상태 변경 (승인/반려/제공).

**권한**: DATA_PLATFORM, AX_TEAM

**Body**:
```json
{
  "status": "APPROVED",
  "comment": "승인 사유",
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

---

### `GET /api/data/provisions`
데이터 제공 내역 목록.

**권한**: DATA_PLATFORM, AX_TEAM

---

### `POST /api/admin/catalog/sync` *(PR #12)*
Snowflake 메타데이터 수동 동기화.

**권한**: AX_TEAM, DATA_PLATFORM

**응답 (200)**:
```json
{ "upserted": 42, "syncedAt": "2026-07-29T05:00:00.000Z" }
```

---

## 4. AI 위원회

### `GET /api/council/meetings`
협의회 회의 목록.

**권한**: AX_TEAM, EXECUTIVE

---

### `POST /api/council/meetings`
협의회 회의 생성.

**권한**: AX_TEAM

**Body**:
```json
{
  "title": "2026년 3분기 협의회",
  "scheduledAt": "2026-09-01T10:00:00.000Z"
}
```

---

### `GET /api/council/meetings/[id]`
협의회 회의 상세.

**권한**: AX_TEAM, EXECUTIVE

---

### `PATCH /api/council/meetings/[id]`
회의 상태 변경.

**권한**: AX_TEAM

---

### `GET /api/council/agenda`
협의회 안건 목록.

**권한**: AX_TEAM, EXECUTIVE

---

### `POST /api/council/agenda`
안건 상정.

**권한**: AX_TEAM

**Body**:
```json
{
  "meetingId": "clxxx",
  "agentId": "clyyy",
  "agendaType": "PRODUCTION_PROMOTION"
}
```

---

### `PATCH /api/council/agenda/[id]/conditions`
안건 심의 조건 체크.

**권한**: AX_TEAM

---

### `POST /api/council/agenda/[id]/decide`
안건 의결.

**권한**: AX_TEAM

**Body**:
```json
{
  "decision": "APPROVED",
  "conditions": "조건부 승인 내용",
  "comment": "의결 코멘트"
}
```
`decision`: `"APPROVED"` | `"REJECTED"` | `"CONDITIONAL"`

---

## 5. AI 도구·토큰 관리

### `GET /api/admin/tokens`
토큰 정책 목록.

**권한**: AX_TEAM

---

### `POST /api/admin/tokens`
토큰 정책 등록.

**권한**: AX_TEAM

**Body**:
```json
{
  "scope": "LEVEL",
  "level": "L2",
  "service": "ChatGPT",
  "monthlyLimit": 300000,
  "warningThreshold": 80
}
```
`scope`: `"GLOBAL"` | `"LEVEL"` | `"EMPLOYEE"`

---

### `GET /api/admin/distribution`
배분 정책 목록.

**권한**: AX_TEAM

---

### `POST /api/admin/distribution`
배분 정책 등록 (서비스 할당).

**권한**: AX_TEAM

**Body**:
```json
{
  "action": "grant",
  "employeeId": "clxxx",
  "serviceName": "ChatGPT Plus"
}
```

---

### `GET /api/admin/tools/quota`
부서별 AI 도구 쿼터 목록.

**권한**: AX_TEAM

---

### `POST /api/admin/tools/quota`
부서 쿼터 등록.

**권한**: AX_TEAM

**Body**:
```json
{
  "department": "리서치팀",
  "toolType": "GPT_CHAT",
  "totalQuota": 10,
  "aiDensity": "HIGH",
  "managedBy": "manager@samsung.com"
}
```

---

### `PATCH /api/admin/tools/[id]`
AI 도구 계정 정보 수정.

**권한**: AX_TEAM

---

### `POST /api/dept/tools/assign`
부서장이 직원에게 AI 도구 배정.

**권한**: DEPT_HEAD

**Body**:
```json
{ "employeeId": "clxxx", "toolAccountId": "clyyy" }
```

---

### `POST /api/dept/tools/revoke`
AI 도구 배정 회수.

**권한**: DEPT_HEAD, AX_TEAM

---

### `POST /api/tools/request`
직원이 AI 도구 신청.

**권한**: EMPLOYEE 이상

---

## 6. 직원·레벨·리터러시

### `GET /api/admin/employees`
직원 전체 목록.

**권한**: AX_TEAM

---

### `POST /api/admin/employees`
직원 등록.

**권한**: AX_TEAM

**Body**:
```json
{
  "employeeId": "SXXXX",
  "email": "user@samsung.com",
  "name": "홍길동",
  "department": "리서치팀",
  "role": "EMPLOYEE"
}
```

---

### `GET /api/admin/employees/export`
직원 목록 CSV 내보내기.

**권한**: AX_TEAM

---

### `PATCH /api/admin/level/[id]`
레벨 신청 처리 (승인/반려).

**권한**: AX_TEAM

**Body**:
```json
{ "status": "APPROVED", "level": "L2" }
```

---

### `GET /api/level`
내 레벨 신청 이력.

**권한**: EMPLOYEE 이상

---

### `POST /api/level`
레벨 상향 신청.

**권한**: EMPLOYEE 이상

**Body**:
```json
{ "targetLevel": "L2", "reason": "신청 사유" }
```

---

### `GET /api/admin/literacy`
리터러시 교육 콘텐츠 목록 + 수료 현황.

**권한**: AX_TEAM

---

### `POST /api/admin/literacy`
리터러시 콘텐츠 등록.

**권한**: AX_TEAM

---

### `GET /api/literacy`
내 리터러시 수료 현황.

**권한**: EMPLOYEE 이상

---

### `POST /api/literacy`
리터러시 학습 완료 처리.

**권한**: EMPLOYEE 이상

---

### `PATCH /api/admin/users/[id]/role`
직원 역할 변경.

**권한**: AX_TEAM

**Body**:
```json
{ "role": "DEPT_HEAD" }
```

---

## 7. 사용량·서비스

### `GET /api/usage`
내 토큰 사용량 조회.

**권한**: EMPLOYEE 이상

**응답 (200)**:
```json
[
  {
    "service": "Claude",
    "yearMonth": "2026-07",
    "tokenUsed": 85000,
    "costKrw": 0,
    "monthlyLimit": 300000
  }
]
```

---

### `GET /api/services`
내 할당 서비스 목록.

**권한**: EMPLOYEE 이상

---

### `GET /api/me/summary`
내 종합 정보 요약 (레벨, 사용량, 과제 수).

**권한**: EMPLOYEE 이상

---

## 8. AI 채팅·자연어

### `POST /api/chat`
Claude AI 채팅 (스트리밍).

**권한**: EMPLOYEE 이상

**Body**:
```json
{ "messages": [{ "role": "user", "content": "안녕하세요" }] }
```

**응답**: SSE 스트리밍 (`text/event-stream`)

---

### `POST /api/nl-query`
자연어로 과제 데이터 조회.

**권한**: EMPLOYEE 이상

**Body**:
```json
{ "query": "이번 달 승인된 과제 보여줘" }
```

---

## 9. 알림

### `GET /api/notifications`
내 미확인 알림 목록.

**권한**: EMPLOYEE 이상

---

### `PATCH /api/notifications`
알림 읽음 처리.

**권한**: EMPLOYEE 이상

---

## 10. 스킬·거버넌스

### `GET /api/skills`
AI 스킬 목록.

**권한**: EMPLOYEE 이상

---

### `POST /api/skills`
스킬 등록.

**권한**: AX_TEAM

---

### `POST /api/skills/rate`
스킬 별점 평가.

**권한**: EMPLOYEE 이상

**Body**:
```json
{ "skillId": "clxxx", "rating": 4 }
```

---

### `GET /api/governance-docs`
거버넌스 문서 목록.

**권한**: EMPLOYEE 이상

---

### `GET /api/governance-docs/meta`
거버넌스 문서 메타 정보.

**권한**: EMPLOYEE 이상

---

## 11. 경영진·요약

### `GET /api/executive`
경영진 대시보드 집계 데이터.

**권한**: EXECUTIVE, AX_TEAM

**응답 (200)**:
```json
{
  "projectStats": { "total": 42, "approved": 30, "pilot": 18, "production": 8 },
  "agentStats": { "active": 12, "retired": 3 },
  "monthlyCost": [
    { "yearMonth": "2026-07", "totalKrw": 150000 }
  ]
}
```

---

### `GET /api/admin/dashboard`
관리자 대시보드 요약.

**권한**: AX_TEAM

---

### `GET /api/admin/console-summary`
관리자 콘솔 통계 요약.

**권한**: AX_TEAM

---

## 12. AX 프로젝트

### `GET /api/ax-projects`
AX 프로젝트 목록 (에이전트 M:N 연결용).

**권한**: AX_TEAM

---

## 13. 이의신청

### `GET /api/appeals`
이의신청 목록.

**권한**: AX_TEAM (전체), EMPLOYEE (내 것만)

---

## API 수 집계

| 카테고리 | API 수 |
|----------|--------|
| 과제 관리 | 6 |
| 에이전트 레지스트리 | 12 |
| 데이터 프로비저닝 | 8 (+1 PR#12) |
| 협의회 | 7 |
| AI 도구·토큰 | 8 |
| 직원·레벨·리터러시 | 9 |
| 사용량·서비스 | 3 |
| AI 채팅·자연어 | 2 |
| 알림 | 2 |
| 스킬·거버넌스 | 4 |
| 경영진·요약 | 3 |
| AX 프로젝트 | 1 |
| 이의신청 | 1 |
| **합계** | **67** |

---

*최초 작성: 2026-07-29*
