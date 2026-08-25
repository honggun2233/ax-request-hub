# AX Hub 워크플로우 v9 — SQLite 제약 정정 + AI 개입 확대(P1)

**작성일**: 2026-08-21
**전제 문서**: v3~v8 설계안
**변경 동기**: (1) v6~v8의 enum 제안이 SQLite와 호환 불가함을 확인, 소급 정정 (2) v9 제안 검토 — 트랙A 반영, 트랙B는 P1만 채택

---

## 1. 소급 정정 — SQLite는 Prisma enum 미지원

기존 스키마 주석: `// SQLite는 enum 미지원 → String 필드 + 코드 레벨 제약`

v6에서 도입한 `enum UsageService/AccountType`, v7의 `enum IntakeMethod`, v8의 `enum FailedGate`는 **현재 `datasource db { provider = "sqlite" }` 환경에 적용 불가**합니다. 전부 String 필드 + 주석 규약으로 되돌립니다. 타입 안전성은 DB 레벨 대신 **API 레벨 Zod validation**으로 확보합니다. PostgreSQL 전환(로드맵 예정) 시점에 일괄 enum화를 별도 마이그레이션 작업으로 진행합니다.

```prisma
// ▼ 정정: enum 전부 String으로 되돌림 (SQLite 제약)
model UsageEvent {
  service      String   // GOVERNANCE_INTAKE | GOVERNANCE_CODEREVIEW | GOVERNANCE_COSTEVAL | GOVERNANCE_RATIONALE | USER_DIRECT
  accountType  String   @default("ENTERPRISE")  // ENTERPRISE | PERSONAL
  sourceType   String   // SYSTEM_GOVERNANCE | USER_DIRECT
  costKrw      Decimal  @db.Decimal(10, 4)       // Decimal은 SQLite에서도 지원, 유지
  // ... 나머지 v6 필드 유지
}

model Project {
  intakeMethod  String  @default("MANUAL_FORM")  // STANDARD_FORMAT | CHAT | FILE | MANUAL_FORM
  failedGate    String? // GATE1A | GATE1B | GATE2 | GATE3_COMMITTEE
  // status는 아래 §2에서 기존값 그대로 유지, 새로 만들지 않음
}
```

**API 레벨 검증 예시** (Zod):
```ts
const UsageServiceSchema = z.enum([
  'GOVERNANCE_INTAKE', 'GOVERNANCE_CODEREVIEW', 'GOVERNANCE_COSTEVAL', 'GOVERNANCE_RATIONALE', 'USER_DIRECT'
])
```

---

## 2. 트랙 A — 구조 수정

### H. status 통합 (v9 원안 수정)

**사실관계 정정**: v9 문서는 "기존 7개 상태값"이라 했으나 확인 결과 `Project.status`는 5개(`submitted|evaluated|pilot|production|closed`)입니다. 7개는 별개 모델인 `AgentRegistry.lifecycleStage`(`DEVELOPING|GATE1|GATE2|GATE3|ACTIVE|DEGRADED|RETIRED`)였습니다. `Project`(신청·심사)와 `AgentRegistry`(배포 후 운영)는 라이프사이클 성격이 달라 하나로 합치면 안 됩니다.

**조치**: v8에서 신설한 `status: IN_PROGRESS|REJECTED|APPROVED|DEPLOYED`는 폐기합니다. 기존 `Project.status` 5개 값을 그대로 사용:

```
GateFail 발생 → status = 'closed' (failedGate 필드로 반려 사유 구분)
Gate1~3 통과 + 위원회 승인 → status = 'evaluated' → 'pilot' → 'production'
```

새 enum·새 상태 체계는 불필요했습니다.

### I. 이의제기 횟수 제한

```prisma
model Project {
  appealCount  Int  @default(0)   // Appeal 제출 시마다 +1, 프로젝트 전체 누적(게이트 무관)
}
```

`AppealCheck` 단계에서 `appealCount >= 2`면 자동 `status = 'closed'`, 이의제기 자체를 막습니다.

### J. SourceCheck 조건 명세

```
SourceCheck 판단 조건 (API 레벨 코드화):
  IF Project.intakeMethod === 'STANDARD_FORMAT' → Tier0 처리건 (True)
  ELSE → Tier1 처리건 (False)
```

---

## 3. 트랙 B — AI 개입 확대 (P1만 채택)

### P1: Gate3 채점 근거 자동 생성 — 채택

```prisma
model ScoreCard {
  // ... 기존 필드 유지 ...

  // ▼ 신규
  rationale    String?  // JSON: { roi: "...", impact: "..." } 항목별 채점 근거
  suggestion   String?  // 임계점 통과를 위한 개선 제안 1~2문장
}
```

```
POST /api/evaluate/[id]
  Gate3 채점 완료 후 Claude API 1회 추가 호출 → rationale/suggestion 생성
  ⚡ UsageEvent 기록: service='GOVERNANCE_RATIONALE', sourceType='SYSTEM_GOVERNANCE', relatedProjectId=projectId
```

v9 원안에 없던 것: **토큰기록 누락**을 보완했습니다. Gate2 코드리뷰·비용평가와 동일하게 이 호출도 `UsageEvent`에 잡혀야 §6(변경이력)에서 지켜온 "심의과정 자체의 토큰 소비를 빠짐없이 기록한다" 원칙이 유지됩니다.

### P2: 위원회 AI 브리핑 — 보류

**보류 사유**: 과거 승인사례 retrieval 시 기밀등급별 접근 필터링이 설계에 없습니다. 위원회 열람 권한 밖의 G3 사례가 브리핑에 섞여 들어갈 위험. **선행조건**: 기밀등급 기반 retrieval 필터 설계 완료 후 재검토.

### P3: 워크플로우 연동 챗봇 — 보류

**보류 사유**: 기존 코드리뷰에서 확인된 **미해결 이슈 — `middleware.ts` 부재로 일부 엔드포인트 인증 우회 위험**이 그대로인 상태에서, "프로젝트 컨텍스트 주입" 챗봇을 얹으면 인가되지 않은 사용자가 타인의 프로젝트 정보에 접근할 공격면이 넓어집니다. 또한 트랙 전체에서 호출 빈도가 가장 높아(사용자당 다회 호출) 회의에서 가장 크게 우려했던 토큰비용 문제가 실제로 발생할 가능성이 가장 큰 지점입니다. **선행조건**: `middleware.ts` 인증 이슈 해결 + 사용자당 일일 호출한도 정책 확정 후 재검토.

---

## 4. 미결 사항 (v8 대비 갱신)

| 항목 | 내용 |
|---|---|
| PostgreSQL 전환 시점 | enum 일괄 적용을 이 시점에 몰아서 처리 |
| P2 재검토 조건 | 기밀등급 기반 retrieval 필터 설계 |
| P3 재검토 조건 | middleware.ts 이슈 해결 + 챗봇 호출한도 정책 |
| ~~이의제기 재검토 SLA, GateFail 통보채널~~ | v8과 동일 미결 |
| ~~Gate1a/1b UI, 표준포맷 버전관리, 확신도 임계값, 엔터프라이즈 API연동, Knox 네이밍~~ | v5~v8과 동일 미결 |

---

## 5. 변경 이력 (v8 → v9)

| 항목 | v8 상태 | v9 조치 |
|---|---|---|
| (소급) enum 전반 | v6~v8에서 4개 enum 도입 | SQLite 미지원 확인 → 전부 String+주석규약으로 환원, API레벨 Zod validation으로 대체 |
| H | v8 신규 `status` 4값 정의 | 사실관계 오류 확인(7개 아닌 5개, 다른 모델과 혼동) → 신규 status 폐기, 기존 `Project.status` 5값 재사용 |
| I | 이의제기 횟수 무제한 | `appealCount` 필드 추가, 2회 초과 시 자동 종료 |
| J | SourceCheck 판단기준 미명세 | `intakeMethod === 'STANDARD_FORMAT'` 조건으로 API 레벨 코드화 |
| P1 | 미도입 | 채택 — `ScoreCard.rationale/suggestion` 추가 + UsageEvent 기록 (v9 원안에 없던 토큰기록 보완) |
| P2 | 미도입 | 보류 — 기밀등급 retrieval 필터 선결 |
| P3 | 미도입 | 보류 — middleware.ts 인증이슈 선결, 토큰비용 리스크 가장 큼 |
