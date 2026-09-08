# Snowflake / AWS Glue 실연동 로드맵

> 작성: Claude AI / 2026-09-07
> 현황: `lib/snowflake.disabled.ts` 존재, `DataAsset.sourceSystem` 필드 있음
> 문제: 지금은 연동 "기록"만 있고 실제 접근권한 강제가 없음 → 거버넌스 위반 리스크

---

## 현재 상태

```
DataAsset.sourceSystem = 'SNOWFLAKE' | 'AWS_GLUE' | 'INTERNAL'
DataAsset.externalId   = 'DB.SCHEMA.TABLE'  (Snowflake 테이블 식별자)
lib/snowflake.disabled.ts  → 비활성화된 SDK 연동 코드
```

**문제**: 에이전트가 `sourceSystem=SNOWFLAKE`인 데이터를 "사용 중"으로 등록해도
실제로 Snowflake에 접근 권한이 있는지 AX Hub가 확인하지 않음.
"기록 시스템"에 머물고 있어서 데이터 거버넌스 원칙(레코딩 vs 결정 시스템)에 위반.

---

## 옵션 비교

### 옵션 A — Snowflake 직접 연동 (풀 구현)

```
AX Hub → Snowflake INFORMATION_SCHEMA 조회
       → 테이블별 권한 확인
       → DataProvision 승인 시 자동 GRANT
       → 회수 시 자동 REVOKE
```

**장점**: 완전한 자동화, 감사 이력 정확
**단점**: Snowflake 계정·네트워크 접근 필요, snowflake-sdk 의존성 추가, 운영 복잡도 급증, 삼성AM 온프레미스 환경에서 외부 클라우드 DB 직접 연동은 보안 심의 필요

**결론**: 지금 단계에서 과도함. 6개월 이상 소요, 보안 심의 별도.

---

### 옵션 B — Webhook/이벤트 기반 반자동화 (권장)

```
AX Hub (승인/회수 이벤트 발행)
  → 데이터플랫폼팀 담당자에게 알림
    → 담당자가 실제 Snowflake/Glue 권한 수동 처리
      → AX Hub에 "처리 완료" 확인 입력
        → DataProvision.externalGranted = true 기록
```

**장점**:
- AX Hub는 이벤트 발행 + 상태 추적만 담당 → 시스템 복잡도 낮음
- 실제 권한 처리는 데이터플랫폼팀 기존 업무 프로세스 활용
- 거버넌스 원칙 충족: "기록"이 아니라 "완료 확인"까지 추적

**구현 범위**:
1. `DataProvision`에 `externalGranted Boolean @default(false)` 필드 추가
2. 승인 시 데이터플랫폼팀에 Knox 알림 (`notify()` 재사용)
3. `/dp/provisions`에 "외부 권한 처리 완료" 확인 버튼
4. `externalGranted=false`인 Snowflake/Glue 프로비전은 Policy Gateway에서 경고(WARN) 처리

**공수**: 1~2일

---

### 옵션 C — 현행 유지 + 면책 명시 (최소)

`DataProvision` 승인 시 "Snowflake/Glue 접근 권한은 데이터플랫폼팀이
별도로 처리해야 합니다" 문구만 추가. 상태 추적 없음.

**단점**: 거버넌스 위반 리스크 그대로. 나중에 "왜 권한 없이 썼냐"는 감사 질문에 답 없음.

---

## 권장: 옵션 B

삼성AM 환경(온프레미스 + 클라우드 혼합)에서 AX Hub가 Snowflake를 직접 제어하는 건
현 단계에서 무리. 대신 "사람이 처리하되, AX Hub가 추적"하는 구조로 거버넌스 원칙을 충족.

---

## Phase 1 구현 스펙 (옵션 B 기준)

### 스키마

```prisma
model DataProvision {
  // 기존 필드들...
  externalGranted     Boolean   @default(false)
  externalGrantedAt   DateTime?
  externalGrantedBy   String?   // 처리한 데이터플랫폼팀 담당자 email
}
```

### Policy Gateway 연동

```ts
// lib/gateway/policy.ts — 기존 체크에 추가
// sourceSystem이 SNOWFLAKE/AWS_GLUE인 DataProvision 중 externalGranted=false가 있으면 WARN
const unconfirmedExternal = provisions.some(
  p => ['SNOWFLAKE', 'AWS_GLUE'].includes(p.dataAsset?.sourceSystem ?? '')
    && !p.externalGranted
)
if (unconfirmedExternal) {
  return { decision: 'DEGRADED', reason: '외부 데이터 소스 접근 권한 미확인' }
}
```

### 알림 흐름

```
DataProvision 승인(PROVISIONED)
  → sourceSystem이 SNOWFLAKE/AWS_GLUE이면
    → 데이터플랫폼팀 전체에 Knox 알림
      "Snowflake 테이블 [externalId] 접근 권한 처리 필요"
      링크: /dp/provisions/[id]
```

### UI

- `/dp/provisions` 목록에 Snowflake/Glue 프로비전 중 `externalGranted=false`인 것 강조 표시
- 상세 화면에 "외부 권한 처리 완료" 버튼 (DATA_PLATFORM 권한)
- 클릭 시 `externalGranted=true`, `externalGrantedAt`, `externalGrantedBy` 기록

---

## AWS Glue

Snowflake와 동일한 패턴 — `sourceSystem='AWS_GLUE'`, `externalId`는 Glue 데이터베이스/테이블 ARN. 구현 코드는 `sourceSystem` 값만 다르고 동일.

---

## 판단 요청

옵션 B로 진행 여부 확인 후 Jarvis 착수 지시서 작성.
Phase 2(Snowflake SDK 직접 연동)는 별도 보안 심의 후 결정.
