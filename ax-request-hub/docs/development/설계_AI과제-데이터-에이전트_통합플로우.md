# AI 과제 신청 · 데이터 요건 · 에이전트 승인 통합 플로우 설계

| 항목 | 내용 |
|------|------|
| 문서 번호 | AX-DESIGN-2026-001 |
| 버전 | v0.1 (초안) |
| 작성일 | 2026-08-05 |
| 작성자 | AX팀 |
| 검토 대상 | 인표님, cwhong |

---

## 1. 문제 진단 — 현재 구조의 갭

### 1-1. 현재 흐름

```
[신청자]
    │
    ▼
① AI 과제 신청 (/submit)
    → Project 레코드 생성
    → 6차원 자동 스코어링
    → AX팀 승인/반려
    │
    ▼ (승인 후)
② 개발 시작 (AX Hub 밖에서)
    │
    ▼
③ 데이터 이용 신청 (/data/requests)  ← ★ 별도 신청, 과제와 느슨하게 연결
    → DATA_PLATFORM 팀 검토
    │
    ▼
④ 에이전트 등록 (/registry)  ← ★ 개발자가 수동으로 별도 등록
    → Gate 1 → Gate 2 → Gate 3 → 협의회 → 상용
```

### 1-2. 발견된 갭

| # | 갭 | 영향 |
|---|---|---|
| G1 | **과제 승인 시점에 데이터 요건 미확인** | 과제 승인 후 데이터 신청 거절 시 이미 한 개발 낭비 |
| G2 | **에이전트와 승인된 과제의 연결 강제 없음** | 승인받지 않은 AI가 `/registry`에 등록될 수 있음 |
| G3 | **"내가 만든 에이전트가 어디 있는지" 확인 불가** | `/status/[id]`(과제 현황)에서 에이전트 상태 안 보임 |
| G4 | **데이터 승인 전에 Gate 2 통과 가능** | Gate 2(보안 검토)가 실제 데이터 사용 범위를 모름 |

---

## 2. 설계 목표

1. **단일 신청**: AI 활용 신청 시 데이터 요건을 함께 선언
2. **추적 가능**: 과제 → 개발 결과물(에이전트/앱) → 승인 상태를 한 화면에서 확인
3. **게이트 연동**: 데이터 승인이 Gate 2의 통과 조건이 됨
4. **강제 연결**: 에이전트 등록 시 반드시 승인된 과제와 연결

---

## 3. 제안 플로우

### 3-1. 전체 흐름

```
[신청자]
    │
    ▼
① AI 과제 + 데이터 요건 통합 신청 (/submit)
   ┌─────────────────────────────────┐
   │ 기존: 과제 정보 (목적·예상효과·기밀등급) │
   │ 신규: 데이터 요건 섹션            │
   │   - 어떤 데이터가 필요한가?         │
   │   - Track A(기존) / Track B(신규)  │
   │   - 기밀 분류 (G1/G2/G3)          │
   │   - 개인정보 포함 여부             │
   │   - 사용 기간                     │
   └─────────────────────────────────┘
    │
    ▼
② 자동 스코어링 + AX팀 과제 심사
   ── 데이터 요건이 G3이면 가중 심사 ──
    │
    ▼ (과제 승인)
③ DataRequest 자동 생성 (status: PENDING_DATA_PLATFORM)
    │                 │
    ▼                 ▼
④ 개발자가 에이전트/앱 개발   DATA_PLATFORM팀 데이터 심사
    │                 │
    ▼                 ▼
⑤ 에이전트 등록 (/registry)  데이터 승인 완료 (DataProvision 생성)
   ── 반드시 승인된 과제 선택 필수 ──
    │
    ▼
⑥ Gate 1 (개발 단계 진입)
    └─ 체크: 연결된 과제가 승인 상태인가?
    │
    ▼
⑦ Gate 2 (보안·데이터 검토)
    └─ 체크: 신청한 데이터가 모두 승인됐는가?  ← ★ 데이터 승인 게이트
    └─ 체크: 정보전략팀 검토 완료 (고위험 과제)
    │
    ▼
⑧ Gate 3 → AI 협의회 의결 → 상용 전환
```

### 3-2. 과제 현황 화면 변경 (`/status/[id]`)

**현재:** 과제 정보 + 스코어카드만 표시

**변경 후:**
```
[과제 현황: ETF 리밸런싱 에이전트]
 상태: 승인 ✅

 ┌── 데이터 승인 현황 ─────────────────┐
 │ Snowflake ETF_PRICE (Track A) ✅ 승인│
 │ KRX 호가 데이터 (Track B) ⏳ 심사중  │
 └────────────────────────────────────┘

 ┌── 개발 결과물 ──────────────────────┐
 │ 에이전트: ETF 리밸런싱 에이전트 v1   │
 │ 라이프사이클: Gate 1 완료 ✅         │
 │ 다음 단계: Gate 2 (보안 검토)        │
 └────────────────────────────────────┘
```

---

## 4. 데이터 모델 변경

### 4-1. Project 모델 — 데이터 요건 필드 추가

```prisma
model Project {
  // ... 기존 필드 ...

  // ★ 신규: 데이터 요건 (제출 시 선언)
  dataRequirements   ProjectDataRequirement[]
}

model ProjectDataRequirement {
  id              String   @id @default(cuid())
  projectId       String
  project         Project  @relation(fields: [projectId], references: [id])

  // 요건 정의
  assetDescription  String    // 데이터 설명 (자유 입력)
  trackType         String    // "ACCESS"(Track A) | "NEW"(Track B)
  classification    String    // "G1" | "G2" | "G3"
  includesPII       Boolean   @default(false)
  periodMonths      Int       @default(12)
  purpose           String    // 사용 목적

  // 승인 후 연결
  dataRequestId   String?   @unique  // 자동 생성된 DataRequest ID
  dataRequest     DataRequest? @relation(fields: [dataRequestId], references: [id])

  createdAt       DateTime  @default(now())
}
```

### 4-2. AgentRegistry — 과제 연결 강제

```prisma
model AgentRegistry {
  // ... 기존 필드 ...

  // ★ 변경: projectId를 필수로 (현재 optional)
  // 에이전트 등록 시 반드시 승인된 과제와 연결
  originProjectId  String?   // 최초 승인된 Project ID
  originProject    Project?  @relation(fields: [originProjectId], references: [id])
}
```

### 4-3. Gate 2 체크리스트에 데이터 승인 항목 추가

```prisma
model Project {
  // ... 기존 Gate 2 필드 ...
  techHasApiSpec            Boolean @default(false)
  techHasDataClassification Boolean @default(false)
  techHasAuditLogging       Boolean @default(false)
  techHasTestCoverage       Boolean @default(false)

  // ★ 신규: 데이터 승인 완료 확인
  techDataApproved          Boolean @default(false)  // DataProvision 모두 생성됐는지
}
```

---

## 5. UI 변경 요약

### 5-1. `/submit` — 데이터 요건 섹션 추가

| 단계 | 항목 | 입력 방식 |
|------|------|-----------|
| 기존 | 과제 목적, 현황, 예상 효과 | 텍스트 |
| 기존 | 기밀 등급 (G1/G2/G3) | 드롭다운 |
| **신규** | **데이터 요건 (선택 추가)** | 반복 폼 |
| 신규 상세 | 필요 데이터 설명 | 텍스트 |
| 신규 상세 | Track A (기존) / Track B (신규) | 라디오 |
| 신규 상세 | 데이터 기밀 등급 | 드롭다운 |
| 신규 상세 | 개인정보 포함 여부 | 체크박스 |
| 신규 상세 | 사용 기간 (개월) | 숫자 |

> 데이터 요건 미입력도 가능 (개발 중 추가 신청 허용)

### 5-2. `/registry` 에이전트 등록 — 과제 연결 필수

- 에이전트 등록 폼에 "승인된 과제 선택" 드롭다운 추가
- 본인이 신청해서 승인된 과제 목록만 표시
- 선택하지 않으면 등록 불가 (과제 없는 에이전트 방지)

### 5-3. `/status/[id]` — 연결 결과물 패널

- "데이터 승인 현황" 카드: DataRequest 목록 + 각 상태
- "개발 결과물" 카드: 연결된 에이전트 + Gate 진행 단계

---

## 6. 단계별 구현 우선순위

| 단계 | 항목 | 우선순위 | 사유 |
|------|------|----------|------|
| **Phase A** | `/submit` 데이터 요건 섹션 | P0 | 거버넌스 핵심 |
| **Phase A** | 과제 승인 시 DataRequest 자동 생성 | P0 | Phase A와 세트 |
| **Phase A** | `/status/[id]` 데이터 승인 현황 카드 | P0 | 신청자 추적 가능성 |
| **Phase B** | `/registry` 과제 연결 필수 | P1 | 에이전트 거버넌스 |
| **Phase B** | `/status/[id]` 개발 결과물 카드 | P1 | Phase B와 세트 |
| **Phase C** | Gate 2 데이터 승인 완료 체크 | P2 | 자동화 가능 |
| **Phase C** | `ProjectDataRequirement` 모델 정식 추가 | P2 | Phase A 임시 → 정식화 |

---

## 7. 미결 결정 사항

| # | 질문 | 선택지 |
|---|------|--------|
| Q1 | 데이터 요건 미입력 시 과제 신청 가능한가? | A: 필수 / B: 선택 (권장: B, 유연성 확보) |
| Q2 | 과제 없는 에이전트 등록을 완전 차단할 것인가? | A: 완전 차단 / B: 경고만 (권장: A, 거버넌스 강화) |
| Q3 | 데이터 미승인 시 Gate 2를 자동 블록할 것인가? | A: 자동 블록 / B: 경고 표시만 (권장: B, 운영 유연성) |

---

*초안 작성: 2026-08-05 | 검토 및 결정 후 구현 착수*
