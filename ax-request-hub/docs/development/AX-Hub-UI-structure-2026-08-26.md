# AX Hub — UI 구조도

**작성일**: 2026-08-26  
**기준 브랜치**: master (커밋 7002e21)  
**목적**: UI 고도화 전 전체 화면 구조 파악 및 개선 포인트 정리

---

## 1. 전체 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│ Sidebar (고정, 좌측 224px)   │ Main Content Area         │
│                              │ (나머지 전체)              │
│  [삼성AM / AI Hub]           │                            │
│  ─── 섹션 헤더 ───           │  각 page.tsx 렌더링        │
│  • 네비게이션 링크            │                            │
│  ─── 사용자 정보 ───          │                            │
│  [아바타 이름 레벨] [로그아웃] │                            │
└──────────────────────────────────────────────────────────┘
```

- **레이아웃 파일**: `app/layout.tsx`
- **사이드바**: `components/Sidebar.tsx`
- **스크롤**: 사이드바 고정(fixed), 메인 컨텐츠 스크롤

---

## 2. 사이드바 네비게이션 — 역할별 노출

### 전 직원 공통 (EMPLOYEE · DEPT_HEAD · 모든 역할)

| 섹션 | 경로 | 페이지명 |
|---|---|---|
| **AI 과제** | `/chat` | 과제 신청 (AI 채팅 인테이크) |
| | `/dashboard` | 내 과제 현황 |
| **나의 현황** | `/me` | 현황 요약 |
| | `/me/tools` | AI 도구 |
| | `/me/usage` | 사용량 |
| | `/me/literacy` | 리터러시 |
| | `/me/level` | 레벨 신청 |
| **데이터** | `/data/catalog` | 카탈로그 검색 |
| | `/me/data` | 내 신청 내역 |
| **참고** | `/skills` | 스킬 카탈로그 |
| | `/docs` | 거버넌스 문서 |

### DEPT_HEAD 추가

| 섹션 | 경로 | 페이지명 |
|---|---|---|
| **팀 관리** | `/dept/tools` | 팀 AI 도구 배분 |

### AX_TEAM / C_LEVEL 추가

| 섹션 | 경로 | 페이지명 |
|---|---|---|
| **운영 현황** | `/admin` | 전체 대시보드 |
| | `/executive` | 경영진 뷰 |
| | `/council` | AI 위원회 |
| **과제·에이전트** | `/registry` | 에이전트 레지스트리 |
| | `/admin/retired` | 폐기 아카이브 |
| **직원·리터러시** | `/admin/employees` | 직원 관리 |
| | `/admin/literacy` | 리터러시 관리 |
| **비용 관리** | `/admin/cost-dashboard` | AI 비용 통합 |
| **도구·계정** | `/admin/distribution` | 서비스 배분 |
| | `/admin/tools/quota-setup` | 부서 계정 할당 |
| | `/admin/tokens` | 토큰 관리 |
| **데이터 관리** | `/dp/requests` | 데이터 요청 검토 |
| | `/dp/catalog` | DP 카탈로그 |
| **스킬·문서** | `/admin/skills` | 스킬 관리 |
| | `/admin/docs` | 문서 관리 |
| **거버넌스** | `/governance` | 감사 로그 |
| | `/graph` | 지식 그래프 |

### DATA_PLATFORM 전용

| 섹션 | 경로 | 페이지명 |
|---|---|---|
| **데이터 플랫폼** | `/dp/requests` | 데이터 요청 검토 |
| | `/dp/catalog` | DP 카탈로그 |

---

## 3. 페이지별 UI 구조

### 3-1. 직원 셀프서비스 영역

#### `/chat` — 과제 신청 (AI 채팅 인테이크)
- 채팅 UI (메시지 입력 + 응답)
- Tier0(표준 폼) / Tier1(AI 대화) 분기 예정

#### `/dashboard` — 내 과제 현황
- 신청한 AI 과제 목록 (상태별)

#### `/me` — 현황 요약
- 사용자 종합 정보 카드

#### `/me/tools` — AI 도구
- 사용 가능한 AI 서비스 목록

#### `/me/usage` — 사용량
- 토큰/비용 사용 현황

#### `/me/literacy` — 리터러시
- AI 리터러시 레벨 현황

#### `/me/level` — 레벨 신청
- 레벨 업 신청 폼

#### `/me/data` — 내 신청 내역
- 데이터 신청 내역 테이블 (상태별 필터)
- 탭: 대기중 / 검토중 / 완료

#### `/me/projects` — 내 프로젝트
- 신청한 AI 과제(프로젝트) 목록

#### `/me/services` — 내 서비스
#### `/me/tools` — 내 AI 도구

---

### 3-2. 데이터 영역

#### `/data/catalog` — 카탈로그 검색 (전 직원)
- 검색바 + 기밀등급 필터
- 데이터 자산 카드 목록
- 자산별 신청 버튼

#### `/dp/catalog` — DP 카탈로그 (DATA_PLATFORM·AX_TEAM)
- 검색바 + 기밀등급 필터
- 데이터 자산 카드 목록
- **ImpactBadge**: 에이전트 N개 (고위험 M개) ← 신규
- **ImpactSlideOver**: 회수 시 영향받는 에이전트 상세 ← 신규

#### `/dp/requests` — 데이터 요청 검토 (DATA_PLATFORM)
- 탭: 대기중 / 검토중 / 완료
- 신청 목록 테이블
- **RequestSheet SlideOver**: 상태변경 폼
  - 상태 드롭다운 (REVIEWING→SEC_REVIEW→APPROVED→COLLECTING→PROVISIONED)
  - **REVOKE 옵션** (PROVISIONED/COLLECTING 상태에서만 노출) ← 신규
  - **RevokeConfirmModal**: 회수 전 영향도 확인 (에이전트 수, 고위험 카운트) ← 신규
  - APPROVED 시 DataProvision 생성 폼 (제공방식·connectionRef·만료일)

---

### 3-3. 에이전트 거버넌스 영역 (AX_TEAM)

#### `/registry` — 에이전트 레지스트리
- **파이프라인 바**: Gate1→Gate2→Gate3→Pilot→Production 단계별 클릭 필터
- **에이전트 카드 목록**: 이름, 목적, 단계, 신뢰점수, Fallback 바
- **에이전트 SlideOver**: 상세 심사 패널
  - 기본 정보 (이름, 목적, 단계, 신뢰점수)
  - Gate 진행도 배너 + 단계 전환 버튼
  - 운용역 태깅
  - **DataDepsPanel**: 의존 데이터 자산 목록 (B방향 영향도) ← 신규
    - 요약행 (전체/G1/회수됨/만료)
    - 자산 카드 (기밀등급·연결유형·상태)

#### `/registry/[id]/kpi-score` — KPI 점수
- 에이전트별 KPI 점수 입력/조회

#### `/admin/retired` — 폐기 아카이브
- 은퇴 처리된 에이전트 목록

---

### 3-4. 관리자 영역 (AX_TEAM)

#### `/admin` — 전체 대시보드
- 운영 지표 카드 (대기 큐, PI 현황, 도입률 등)
- 예외 알림 목록

#### `/executive` — 경영진 뷰
- 경영진용 요약 지표

#### `/council` — AI 위원회
- 위원회 회의 목록

#### `/council/[meetingId]` — 회의 상세
#### `/council/[meetingId]/agenda/[itemId]` — 안건 상세

#### `/admin/employees` — 직원 관리
- 직원 목록, 역할·레벨 관리

#### `/admin/literacy` — 리터러시 관리
- 전사 리터러시 현황

#### `/admin/cost-dashboard` — AI 비용 통합 (A/B/C 트랙)
- 트랙별 비용 현황

#### `/admin/tokens` — 토큰 관리
- 토큰 사용량 조회

#### `/admin/distribution` — 서비스 배분
- AI 서비스 부서별 배분 현황

#### `/admin/tools/quota-setup` — 부서 계정 할당
- 부서별 AI 도구 할당량 설정

#### `/admin/skills` — 스킬 관리
#### `/admin/docs` — 문서 관리
#### `/admin/audit` — 감사 관련
#### `/admin/query` — 쿼리

---

### 3-5. 기타 주요 화면

#### `/projects/new` — 새 AI 과제 신청 폼
- ProjectForm 컴포넌트
- 과제 기본정보, 기대효과(서술), 데이터 요구사항

#### `/submit` — 신청 완료

#### `/skills` — 스킬 카탈로그
#### `/docs` — 거버넌스 문서 뷰어
#### `/governance` — 감사 로그
#### `/graph` — 지식 그래프 시각화
#### `/status/[id]` — 상태 페이지

#### `/login` — 로그인
- 이메일 입력 (DEV_BYPASS_USER 환경에서 비밀번호 없이 통과)

---

## 4. 컴포넌트 레이어

```
components/
├── Sidebar.tsx          ← 전역 네비게이션 (역할별 분기)
├── ProjectForm.tsx       ← 과제 신청 폼 (재사용)
└── (기타)

src/components/
├── ProjectForm.tsx       ← 동일 (경로 중복 — 정리 필요)
└── ...

lib/
├── prisma.ts            ← DB 클라이언트
├── auth.ts              ← NextAuth 설정
├── authz.ts             ← 역할 기반 권한 (requireRole)
├── confidentiality.ts   ← CONF_LABEL·CONF_COLOR 상수
└── impact-graph.ts      ← 영향도 그래프 탐색 (신규)
```

---

## 5. 역할(Role) × 접근 가능 화면 매트릭스

| 화면 | EMPLOYEE | DEPT_HEAD | AX_TEAM | DATA_PLATFORM | C_LEVEL |
|---|:---:|:---:|:---:|:---:|:---:|
| /chat | ✅ | ✅ | ✅ | ✅ | ✅ |
| /dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| /me/* | ✅ | ✅ | ✅ | ✅ | ✅ |
| /data/catalog | ✅ | ✅ | ✅ | ✅ | ✅ |
| /me/data | ✅ | ✅ | ✅ | ✅ | ✅ |
| /dept/tools | — | ✅ | — | — | — |
| /dp/requests | — | — | ✅ | ✅ | — |
| /dp/catalog | — | — | ✅ | ✅ | — |
| /registry | — | — | ✅ | — | ✅ |
| /admin/* | — | — | ✅ | — | ✅ |
| /executive | — | — | ✅ | — | ✅ |
| /governance | — | — | ✅ | — | — |
| /graph | — | — | ✅ | — | — |

---

## 6. 현재 UI 현황 및 개선 포인트

### 완료된 기능 ✅
- 사이드바 역할별 분기 네비게이션
- 데이터 신청 워크플로우 (REQUESTED→REVIEWING→APPROVED→PROVISIONED)
- 에이전트 레지스트리 파이프라인 바 + SlideOver 심사 패널
- DP 카탈로그 — ImpactBadge + ImpactSlideOver (A방향 영향도)
- DP 요청 검토 — RevokeConfirmModal (회수 전 영향도 확인)
- 에이전트 레지스트리 — DataDepsPanel (B방향 의존성)
- `/data/catalog` — 직원 카탈로그 검색 기본 UI

### 개선 후보 🔧
1. **사이드바 섹션 과다** — AX_TEAM 기준 섹션 9개, 링크 20개 이상. 접기/펼치기 또는 그룹화 필요
2. **`/chat` 인테이크** — 현재 단순 채팅, Tier0(표준폼)/Tier1(AI구조화) 분기 UI 미완성
3. **`/admin` 대시보드** — PI 추적 카드 제거 후 레이아웃 빈 공간 정리 필요
4. **`/registry` SlideOver** — DataDepsPanel 추가로 패널이 길어짐, 탭 구조 검토
5. **`/data/catalog`** — 직원용과 DP용(dp/catalog) 구조 유사 → 역할별 뷰 통합 고려
6. **모바일 반응형** — 현재 사이드바 224px 고정, 모바일 미지원
7. **`/me` 요약 페이지** — 현황 카드 구성 재정비 필요 (TASK_me_리디자인.md 참고)
8. **`/projects/new`** — 과제 신청 폼과 `/chat` 채팅 인테이크 진입점 중복 정리
9. **토큰 관리 A트랙** — Claude Analytics API 키 발급 완료 후 UI 연결 필요
