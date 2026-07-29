# AX Hub 지식 그래프 설계 문서

| 항목 | 내용 |
|------|------|
| 문서번호 | AX-DESIGN-2026-KG-001 |
| 버전 | v1.0 |
| 작성일 | 2026-07-29 |
| 담당 | AX/PI센터 AX팀 (CTO 구현) |

---

## 1. 목적 및 배경

AX Hub에 축적된 과제·에이전트·데이터·임직원 정보는 현재 각자 독립된 화면에서만 조회된다.  
지식 그래프는 이 데이터를 **노드(Entity)**와 **엣지(관계)**로 연결하여 "이 에이전트가 어떤 데이터를 쓰고, 어떤 과제에 속하고, 누가 책임자인지"를 한눈에 보여준다.

---

## 2. 단계별 구현 범위

### Phase ① — 과제-에이전트-데이터 관계 맵 *(즉시 착수 가능)*

현재 AX Hub DB에 데이터가 이미 존재. 연결만 추가하면 됨.

**구현 대상**: 과제(Project) · 에이전트(Agent) · 데이터 자산(DataAsset) · 담당자(Employee) 간 관계 시각화

### Phase ② — 임직원 지식 축적 맵 *(Phase ① 안정화 후)*

리터러시 레벨·담당 과제·사용 도구 연결. AI 역량 분포 파악, 과제 승계·이탈 리스크 관리.

### Phase ③ — AI 생성물 출처 추적 *(로그 수집 체계 선행 필요)*

어떤 모델·프롬프트로 어떤 결과를 냈는지 연결. 규정 제9조 감사 추적 강화 목적.

---

## 3. 그래프 스키마

### 3-1. 노드 정의

| 노드 타입 | Label | 주요 속성 | 연결 Phase | 기존 DB 테이블 |
|-----------|-------|-----------|-----------|----------------|
| 과제 | `Project` | id, title, status, riskLevel, createdAt | ①②③ | `AXProject` |
| 에이전트 | `Agent` | id, name, lifecycleStage, trustScore | ①③ | `Agent` |
| 데이터 자산 | `DataAsset` | id, name, secretLevel(G1/G2/G3), owner | ①③ | `DataAsset` |
| 임직원 | `Employee` | id, name, dept, literacyLevel, crewLevel | ①② | `User` |
| AI 생성물 | `AIArtifact` | id, modelUsed, promptHash, createdAt | ③ | *(신규 테이블)* |

### 3-2. 엣지 정의

#### Phase ① 엣지

| 엣지 | From | To | 의미 | 속성 |
|------|------|----|------|------|
| `BELONGS_TO` | Agent | Project | 에이전트가 과제에 속함 | since |
| `CONSUMES` | Agent | DataAsset | 에이전트가 데이터를 사용 | purpose, accessLevel |
| `USES_DATA` | Project | DataAsset | 과제가 데이터를 활용 | status(REQUESTED/PROVISIONED) |
| `OWNED_BY` | Project | Employee | 과제 책임자 | role(OWNER/COLLABORATOR) |
| `MANAGES` | Employee | Agent | 운용역/담당자 | since |

#### Phase ② 추가 엣지

| 엣지 | From | To | 의미 | 속성 |
|------|------|----|------|------|
| `HAS_LEVEL` | Employee | LiteracyLevel | 리터러시 레벨 보유 | grantedAt |
| `WORKS_ON` | Employee | Project | 프로젝트 참여 | role |
| `USES_TOOL` | Employee | AITool | 사용 AI 도구 | frequency |

#### Phase ③ 추가 엣지

| 엣지 | From | To | 의미 | 속성 |
|------|------|----|------|------|
| `GENERATED_BY` | AIArtifact | Agent | 에이전트가 생성 | timestamp |
| `PROMPTED_WITH` | AIArtifact | Prompt | 사용된 프롬프트 | tokenCount |
| `USED_IN` | AIArtifact | Project | 과제에 활용 | context |
| `PRODUCED_BY_MODEL` | AIArtifact | AIModel | 사용 모델 | version |

---

## 4. 기술 스택 결정

### 4-1. 결정: PostgreSQL + 그래프 시각화 레이어

Neo4j 전용 그래프 DB는 **채택하지 않는다**.

| 항목 | PostgreSQL 방식 | Neo4j 방식 |
|------|----------------|-----------|
| 인프라 추가 | 없음 | Neo4j 서버 신규 구축 필요 |
| 운영 비용 | 현재 DB 비용 포함 | 별도 라이선스·운영 비용 |
| 개발 속도 | 빠름 (Prisma 스키마 확장) | 느림 (새 쿼리 언어 Cypher 학습) |
| 현재 스케일 적합성 | ✅ 충분 | 과잉 |
| 확장성 | 중간 (복잡한 다단계 순회는 느려짐) | 높음 |

**결론**: 현재 데이터 규모(수십 개 에이전트·과제)에서는 PostgreSQL로 충분.  
추후 데이터가 수만 노드 이상으로 증가하면 Neo4j 마이그레이션 고려.

### 4-2. 구현 방식

```
[Prisma Schema]
  관계 테이블 추가 (AgentProjectLink, AgentDataLink 등)
       ↓
[Next.js API]
  /api/graph/nodes  — 노드 목록 반환
  /api/graph/edges  — 엣지 목록 반환
  /api/graph/explore?nodeId=xxx&depth=2  — 특정 노드에서 N홉 탐색
       ↓
[React 컴포넌트 — /graph 페이지]
  Cytoscape.js (추천) 또는 D3-force 로 그래프 렌더링
```

### 4-3. 시각화 라이브러리 비교

| 라이브러리 | 장점 | 단점 | 추천 |
|-----------|------|------|------|
| **Cytoscape.js** | 빠름·안정·React 연동 쉬움·레이아웃 다양 | 커스텀 스타일 약간 복잡 | ✅ 1순위 |
| D3-force | 자유도 최고 | 학습 비용 높음, 코드량 많음 | 2순위 |
| React Flow | UI 노드 편집에 강함 | 순수 그래프 탐색보다 플로우 차트 용도 | 부적합 |

---

## 5. Prisma 스키마 확장 (Phase ①)

기존 `AgentProjectLink` 테이블이 이미 존재. 아래 테이블을 추가한다.

```prisma
// 에이전트 ↔ 데이터 자산 연결
model AgentDataLink {
  id          String    @id @default(cuid())
  agentId     String
  dataAssetId String
  purpose     String?
  accessLevel String    @default("READ")
  createdAt   DateTime  @default(now())

  agent     Agent     @relation(fields: [agentId], references: [id])
  dataAsset DataAsset @relation(fields: [dataAssetId], references: [id])

  @@unique([agentId, dataAssetId])
}

// 과제 ↔ 데이터 자산 연결 (DataRequest 기반 — 이미 존재, 뷰만 추가)

// 임직원 ↔ 에이전트 관리 관계
model EmployeeAgentLink {
  id         String   @id @default(cuid())
  userId     String
  agentId    String
  role       String   @default("MANAGER") // MANAGER | COLLABORATOR
  since      DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id])
  agent Agent @relation(fields: [agentId], references: [id])

  @@unique([userId, agentId])
}
```

---

## 6. API 설계 (Phase ①)

### GET `/api/graph/overview`
전체 그래프 개요 반환 (노드 수·엣지 수·타입별 분포)

```json
{
  "nodes": { "Project": 12, "Agent": 19, "DataAsset": 8, "Employee": 45 },
  "edges": { "BELONGS_TO": 24, "CONSUMES": 31, "OWNED_BY": 12 }
}
```

### GET `/api/graph/nodes?type=Agent&status=ACTIVE`
필터 조건으로 노드 목록 반환

### GET `/api/graph/edges?from=agent&fromId=xxx`
특정 노드의 연결 엣지 전체 반환

### GET `/api/graph/explore?nodeId=xxx&depth=2`
특정 노드에서 depth홉 이내 연결 노드·엣지 반환 (그래프 탐색)

```json
{
  "center": { "id": "xxx", "type": "Agent", "name": "ComplianceAgent" },
  "nodes": [...],
  "edges": [...]
}
```

---

## 7. UI 설계 — `/graph` 페이지

### 7-1. 레이아웃

```
┌────────────────────────────────────────────────┐
│ 필터 바: [노드 타입 ▼] [기밀등급 ▼] [부서 ▼]      │
├──────────────────────────────┬─────────────────┤
│                              │  선택 노드 상세  │
│   Cytoscape.js 그래프 캔버스   │  ──────────────│
│                              │  이름: xxx      │
│   ● Project                  │  상태: ACTIVE   │
│   ■ Agent                    │  연결: 3개      │
│   ▲ DataAsset                │  담당자: 홍인표  │
│   ◆ Employee                 │                 │
│                              │  [상세 보기 →]  │
└──────────────────────────────┴─────────────────┘
```

### 7-2. 인터랙션

- 노드 클릭 → 오른쪽 패널에 상세 정보 표시
- 노드 더블클릭 → 해당 노드 중심으로 그래프 재렌더링 (탐색 드릴다운)
- 엣지 hover → 관계 레이블 표시
- 필터 변경 → 해당 타입 노드/엣지만 표시

### 7-3. 노드 색상 코드

| 타입 | 색상 | 아이콘 |
|------|------|--------|
| Project | `#4F46E5` (인디고) | 폴더 |
| Agent | `#059669` (그린) | 로봇 |
| DataAsset G1 | `#6B7280` (그레이) | DB |
| DataAsset G2 | `#D97706` (오렌지) | DB 잠금 |
| DataAsset G3 | `#DC2626` (레드) | DB 잠금 강조 |
| Employee | `#7C3AED` (퍼플) | 사람 |

---

## 8. 구현 순서 (Phase ①)

| 순서 | 작업 | 예상 소요 |
|------|------|-----------|
| 1 | Prisma 스키마 확장 (AgentDataLink·EmployeeAgentLink 추가) + 마이그레이션 | 0.5일 |
| 2 | 시드 데이터 — 기존 에이전트·과제·데이터 자산 연결 초기값 입력 | 0.5일 |
| 3 | `/api/graph/*` API 3종 구현 | 1일 |
| 4 | Cytoscape.js 설치 + `/graph` 페이지 기본 렌더링 | 1일 |
| 5 | 필터·사이드 패널·드릴다운 인터랙션 | 1일 |
| 6 | 사이드바 메뉴 연결 + QA | 0.5일 |
| **합계** | | **약 4~5일** |

---

## 9. Phase ②③ 확장 계획 요약

### Phase ② 추가 작업
- `User` 테이블에 `literacyLevel`, `crewLevel` 필드 확인 (기존 존재 여부 확인)
- `EmployeeToolLink` 테이블 추가 (임직원 ↔ 사용 도구)
- 그래프에 Employee 노드 추가, 역량 분포 히트맵 레이어 추가

### Phase ③ 추가 작업 (선행 조건: 감사 로그 수집 체계 완비)
- `AIArtifact`, `Prompt`, `AIModel` 테이블 신규 설계
- 모델 호출 시 자동 로깅 미들웨어 구현
- 출처 추적 그래프 뷰 (`/graph/audit`) 별도 페이지

---

## 10. 제약 사항

- G3 데이터 자산은 그래프에서 **노드 존재는 표시하되, 실제 데이터 내용은 표시하지 않는다**. (기밀등급 준수)
- 그래프 API는 인증된 사용자만 접근 가능. 역할별 가시 범위:
  - `EMPLOYEE`: 자신이 연관된 노드만 조회
  - `AX_TEAM`, `EXECUTIVE`: 전체 조회

---

*AX/PI센터 AX팀 | AX-DESIGN-2026-KG-001 | v1.0 | 2026-07-29*
