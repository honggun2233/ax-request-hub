# AI 과제 신청 · 데이터 요건 · 에이전트 승인 통합 플로우 설계

| 항목 | 내용 |
|------|------|
| 문서 번호 | AX-DESIGN-2026-001 |
| 버전 | v0.2 (세 기둥 검증 반영) |
| 작성일 | 2026-08-05 |
| 작성자 | AX팀 |
| 검토 대상 | 인표님, cwhong |

---

## 0. AX Hub 핵심 목적 — 세 기둥

> 이 세 기둥이 모든 기능의 기준이다. 기능을 추가하거나 설계를 검토할 때 이 기둥 중 어느 것을 지원하는지 먼저 물어야 한다.

| 기둥 | 핵심 질문 | 현재 완결성 |
|------|----------|------------|
| **기둥1 — AI 모델 배분·배포** | 어떤 AI 도구/토큰을 누구에게 얼마나 줄 것인가 | 70% |
| **기둥2 — 에이전트 개발 지원** | 승인된 AI 도구와 데이터로 에이전트를 잘 만들 수 있도록 돕는가 | 60% ← 가장 약함 |
| **기둥3 — 에이전트 관리** | 만들어진 에이전트가 Gate를 거쳐 안전하게 운영·관리되는가 | 75% |

### 기둥 간 연결 갭 (현재)

| 연결 | 갭 내용 |
|------|---------|
| **기둥1→2** | 리터러시 레벨이 과제 신청 자격에 미연동. 배정받은 도구로 어떤 에이전트를 만들 수 있는지 안내 없음 |
| **기둥2→3** | 과제 승인 → 에이전트 등록 연결 없음. 신청자가 에이전트 Gate 현황을 볼 수 없음 ← **이 문서의 핵심 해결 대상** |
| **기둥1→3** | 운영 중 에이전트가 어떤 모델/토큰을 얼마나 쓰는지 추적 안 됨 |

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

> **주의**: `AgentRegistry`에는 이미 `projectId String?` (FK → Project)가 존재.
> `originProjectId`를 별도 추가하면 중복. 기존 `projectId`를 필수화하는 방향으로 변경.

```prisma
model AgentRegistry {
  // ... 기존 필드 ...

  // ★ 변경: 기존 projectId를 String → String (필수)으로 변경
  // (현재 optional → 필수화, 신규 필드 추가 없음)
  projectId  String    // 승인된 Project ID (에이전트 등록 시 반드시 선택)
  project    Project   @relation(fields: [projectId], references: [id])

  // 참고: AXProject M:N 연결(AgentProjectLink)은 별도 유지 (운용 분류 목적)
}
```

> **DataRequest.projectId 정책 결정 필요** (현재 충돌)
> - 2026-08-05 변경: `DataRequest.projectId`를 `String?` (optional)로 변경 — 범용 데이터 신청 허용
> - 통합플로우 방향: 과제-데이터 연결 강화
> - **권고**: 두 경우를 분리 유지. 과제에서 나온 DataRequest는 `projectId` 필수, 독립 데이터 신청은 optional 허용. 신청 폼에서 "과제 연결" 여부를 명시 선택하도록 UX 처리.

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

## 5-4. 에이전트 라이프사이클 — 현재 구현 상태와 연결 갭

### 현재 `/registry` 라이프사이클 UI (이미 구현됨)

```
에이전트 카드
 ├── 현재 단계 배지 (DEVELOPING / GATE1 / GATE2 / GATE3 / ACTIVE / DEGRADED / RETIRED)
 ├── Gate 통과 진행도 (G1 ✓ / G2 – / G3 –)
 ├── Fallback율 바 (≤30% 정상 / ≤70% 경고 / >70% 위험)
 └── [슬라이드오버] 단계 전환 액션 + 신뢰점수 입력

단계별 기준 (이미 정의됨)
 ├── GATE1: fallback율 ≤ 30%, AgentSignal 정상
 ├── GATE2: 30일 정확도 ≥ 55%, 신뢰점수 ≥ 3, 데이터 승인 완료 ← 신규 조건 추가
 └── GATE3: 이상값/데이터없음 시 크래시 0
```

### 현재 연결 갭

| 문제 | 현재 | 목표 |
|------|------|------|
| 에이전트 등록 시 출처 과제 | `AXProject`(별도 테이블)에 수동 연결 | 승인된 `Project` 신청서와 직접 연결 (강제) |
| 과제 신청자가 자기 에이전트 현황 파악 | `/registry` 직접 가서 검색 | `/status/[id]` 에서 바로 확인 |
| 과제 심사자(AX팀)가 에이전트 진행 현황 파악 | 별도 확인 없음 | `/admin`에서 과제별 에이전트 Gate 상태 표시 |

### 완성 후 사용자 경험 (End-to-End)

```
① 신청자: AI 과제 + 데이터 요건 제출 (/submit)
         │
         ▼
② 시스템: 과제 승인 완료
   → 과제 현황 페이지(/status/[id])에 배너 노출:
     ┌─────────────────────────────────────────┐
     │ ✅ 과제 승인됨. 에이전트를 등록하세요.  │
     │       [에이전트 등록하기 →]            │
     └─────────────────────────────────────────┘
         │
         ▼
③ 신청자: 에이전트 등록 (/registry/new?projectId=xxx)
   → 과제 ID가 URL 파라미터로 전달되어 자동 연결
   → 에이전트 등록 시 lifecycleStage = DEVELOPING (자동)
         │
         ▼
④ 과제 현황 페이지(/status/[id]) — 에이전트 카드 표시:
   ┌── 개발 결과물 ──────────────────────────────────────┐
   │ 📦 ETF 리밸런싱 에이전트 v1                         │
   │ 현재 단계: Gate 1 QA 검증 중 ⏳                     │
   │ Gate 진행도: G1 ⏳ → G2 – → G3 –                   │
   │ Fallback율: 22% ✅  신뢰점수: 3/5                   │
   │                     [레지스트리에서 상세보기 →]     │
   └──────────────────────────────────────────────────┘
         │
         ▼
⑤ AX팀 / 심사자: Gate 2 심사 시 데이터 승인 여부 자동 체크
   → DataProvision 모두 생성됐는지 시스템이 검증
   → 미승인 데이터가 있으면 Gate 2 전환 버튼 비활성화 + 사유 표시
         │
         ▼
⑥ 협의회 의결 → 상용 전환 (ACTIVE)
   → 과제 현황 페이지에 "🟢 운영 중" 상태 최종 표시
```

### `/registry` 에이전트 카드에 출처 과제 표시 (추가)

현재 에이전트 카드에는 AXProject 도메인(ETF/운영/효율화)만 표시됨.
변경 후: "출처 과제: [과제명]" 링크 추가 → `/status/[projectId]`로 이동

---

## 6. 단계별 구현 우선순위

| 단계 | 항목 | 우선순위 | 사유 |
|------|------|----------|------|
| **Phase A** | `/submit` 데이터 요건 섹션 | P0 | 거버넌스 핵심 |
| **Phase A** | 과제 승인 시 DataRequest 자동 생성 | P0 | Phase A와 세트 |
| **Phase A** | `/status/[id]` 데이터 승인 현황 카드 | P0 | 신청자 추적 가능성 |
| **Phase B** | `/registry` 과제 연결 필수 (`originProjectId`) | P1 | 에이전트 거버넌스 |
| **Phase B** | 과제 승인 후 "에이전트 등록하기" 배너 (`/status`) | P1 | 신청자 → 등록 유도 |
| **Phase B** | `/registry/new?projectId=xxx` — 과제 자동 연결 | P1 | Phase B와 세트 |
| **Phase B** | `/status/[id]` 개발 결과물 카드 (Gate 단계 + fallback율) | P1 | 신청자 실시간 확인 |
| **Phase C** | Gate 2 데이터 승인 완료 자동 체크 | P2 | 자동화 가능 |
| **Phase C** | `/registry` 에이전트 카드에 "출처 과제" 링크 | P2 | 역방향 추적 |
| **Phase C** | `ProjectDataRequirement` 모델 정식 추가 | P2 | Phase A 임시 → 정식화 |

---

## 7. 정책 결정 사항 (2026-08-05 확정)

| # | 질문 | **확정 결정** | 구현 방향 |
|---|------|--------------|----------|
| Q1 | 데이터 요건 미입력 시 과제 신청 가능한가? | **B: "데이터 없음" 명시 강제** | 신청 폼에 "별도 데이터 불필요" 체크박스 — 미선택 시 제출 차단 |
| Q2 | 과제 없는 에이전트 등록을 완전 차단할 것인가? | **A: 완전 차단** | AgentRegistry 등록 API에서 projectId 검증 필수. 승인된 Project 없으면 400 반환 |
| Q3 | 데이터 미승인 시 Gate 2를 자동 블록할 것인가? | **B: 경고 표시만** | Gate 2 전환 버튼은 활성화 유지. 단, 미승인 DataRequest 목록을 빨간 경고 배너로 표시 |
| Q4 | DataRequest.projectId: 과제 연결 필수 vs optional? | **B: 과제 연결 여부 명시 선택** | 신청 폼에 "과제 연결" 토글 — ON 시 과제 선택 필수(projectId 저장), OFF 시 null 허용 |

---

## 8. Phase A 구현 상세 (Q1~Q4 반영)

> 이 섹션은 개발자(cwhong)가 구현 시 참고하는 기준입니다.

### Phase A-1: `/submit` 폼 — 데이터 요건 섹션 추가

**변경 파일**: `app/submit/page.tsx` (또는 `app/projects/new/page.tsx`)

추가할 섹션 (폼 하단):
```
[데이터 요건]
  ○ 이 과제는 별도 데이터가 필요 없습니다  ← Q1: 반드시 이 중 하나 선택
  ○ 아래 데이터가 필요합니다:
      + 데이터 추가
      ┌──────────────────────────────────────────┐
      │ 데이터 설명        [텍스트 입력]          │
      │ 유형               ○ Track A  ○ Track B   │
      │ 기밀 등급          [G1 / G2 / G3]        │
      │ 개인정보 포함      □ 포함                 │
      │ 사용 기간          [  ] 개월              │
      └──────────────────────────────────────────┘
```

**API 변경**: `POST /api/projects` — 요청 body에 `dataRequirements[]` 배열 추가
```typescript
dataRequirements: Array<{
  assetDescription: string
  trackType: 'ACCESS' | 'NEW'
  classification: 'G1' | 'G2' | 'G3'
  includesPII: boolean
  periodMonths: number
  purpose: string  // project.description에서 자동 복사 가능
}>
noDataRequired: boolean  // Q1: true면 dataRequirements 빈 배열 허용
```

### Phase A-2: 과제 승인 시 DataRequest 자동 생성

**변경 파일**: `app/api/approve/[id]/route.ts`

과제 승인(status → 'approved') 처리 시:
```typescript
// 승인 핸들러 내부
if (project.dataRequirements.length > 0) {
  await prisma.dataRequest.createMany({
    data: project.dataRequirements.map(req => ({
      projectId: project.id,
      employeeId: project.requester.id,
      type: req.trackType,
      classification: req.classification,
      assetDescription: req.assetDescription,
      includesPII: req.includesPII,
      periodMonths: req.periodMonths,
      status: 'PENDING',   // DATA_PLATFORM 팀 큐에 들어감
    }))
  })
}
```

### Phase A-3: `/status/[id]` — 두 개 카드 추가

**변경 파일**: `app/status/[id]/page.tsx`

추가할 UI 블록 두 개:
1. **데이터 승인 현황 카드**: 연결된 DataRequest 목록 + 각 상태(PENDING/APPROVED/REJECTED)
2. **개발 결과물 카드**: 연결된 AgentRegistry + 현재 Gate 단계 + fallback율 (에이전트 없으면 "에이전트 등록하기" CTA 표시)

**API**: `GET /api/projects/[id]` 에 `include: { dataRequests: true, agentRegistries: true }` 추가

### Phase B-1: `/registry` — 과제 연결 필수 (Q2)

**변경 파일**: `app/api/registry/route.ts` (POST 핸들러)
```typescript
// Q2: 과제 없는 에이전트 등록 차단
if (!body.projectId) {
  return NextResponse.json({ error: '승인된 과제를 선택해야 합니다.' }, { status: 400 })
}
const project = await prisma.project.findUnique({ where: { id: body.projectId, status: 'approved' } })
if (!project) {
  return NextResponse.json({ error: '승인된 과제가 아닙니다.' }, { status: 400 })
}
```

---

*초안 작성: 2026-08-05 | 정책 결정: 2026-08-05 | Phase A 구현 준비 완료*
