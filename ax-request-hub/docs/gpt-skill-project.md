# AX Hub GPT 스킬 배포 프로젝트

> 목표: AX Hub를 통해 삼성자산운용 전직원이 사용할 GPT 스킬을 체계적으로 제작·관리·배포한다.
> 시작일: 2026-09-11 | 담당: AX팀 홍인표 수석

---

## 1. 프로젝트 배경 및 목표

### 배경
- 회사 ChatGPT 사용이 확대되면서 부서별·업무별 특화 스킬 수요 발생
- 개인이 각자 프롬프트를 관리하면 품질 편차가 크고 노하우 공유가 안 됨
- AX Hub를 허브로 삼아 검증된 스킬을 중앙 관리·배포하는 체계 필요

### 목표
1. 업무 도메인별 GPT 스킬을 표준 포맷으로 제작한다
2. AX Hub 스킬 카탈로그에 등록하여 전직원이 검색·사용할 수 있게 한다
3. 스킬 등록→검토→승인→배포 워크플로우를 AX Hub 안에서 완결한다

---

## 1-1. 용어 분리 (혼동 방지)

이 프로젝트에서 "스킬"이라는 단어는 세 가지 완전히 다른 개념에 쓰인다. 명확히 구분한다.

| 용어 | 실체 | 사용처 |
|---|---|---|
| **Claude/OpenClaw 스킬** | Claude가 자동 로드해서 행동을 바꾸는 YAML+MD 파일 | OpenClaw 스킬 폴더, claude.ai 프로필 |
| **GPT 프롬프트 카드** (`*-SKILL.md`) | 사람이 GPT에 복사·붙여넣는 프롬프트 정의서 | `C:\Users\Samsung\Downloads\`, 회사 GPT 플러그인 |
| **AX Hub 프롬프트 카탈로그** | 전직원이 GPT 프롬프트를 검색·복사·평점하는 허브 (`Skill` DB 모델) | `/skills` 페이지, DB |

> **파일명 규칙**: GPT 프롬프트 카드는 `*-SKILL.md` 이름을 유지한다. 단, 이 파일들은 Claude SKILL.md와 **목적·배포 채널이 완전히 다르다**.
> **DB 스키마**: `Skill` 모델명은 현재 유지. 데이터가 없는 지금이 리네임 비용이 가장 낮으므로, 데이터가 쌓이기 전에 `GptPromptCard`로 변경하는 것을 검토한다.

---

## 2. AX Hub ↔ 스킬 프로젝트 관계도

```
┌─────────────────────────────────────────────────────────────┐
│                    GPT 스킬 생태계                            │
│                                                             │
│  [SKILL.md 파일]          [AX Hub 스킬 카탈로그]            │
│  - GPT 커스텀 인스트럭션   - /skills 페이지 (전직원 접근)     │
│  - 도메인 전문 지식 정의    - DB: Skill 모델                 │
│  - 작성 기준 & 제약사항    - 카테고리 검색 + 평점             │
│         │                         │                         │
│         └──────── 임포트 ──────────┘                         │
│                   (미구현 → 개발 필요)                        │
│                                                             │
│  [AX Hub Admin]                   [GPT 플러그인]            │
│  - POST /api/skills (등록 API)    - SKILL.md 직접 등록       │
│  - PATCH /api/skills (승인)       - 회사 GPT 채널 연동        │
│  - Admin UI → 미구현               (별도 프로세스)            │
└─────────────────────────────────────────────────────────────┘
```

### 두 채널의 역할 구분

| 채널 | 목적 | 대상 | 현재 상태 |
|---|---|---|---|
| **SKILL.md 파일** | GPT 커스텀 인스트럭션 정의 | 개발자·AX팀 | ✅ 8종 완성 |
| **AX Hub 스킬 카탈로그** | 전직원 스킬 검색·복사·평점 | 전직원 | ✅ UI/API 구현됨, 데이터 미입력 |
| **GPT 플러그인 등록** | 회사 GPT에 스킬 직접 연동 | GPT 사용자 | 🔜 별도 프로세스 |

---

## 3. AX Hub 스킬 기능 현황 (코드 검증 결과)

### 3.1 구현 완료

| 기능 | 파일 | 비고 |
|---|---|---|
| Skill DB 모델 | `prisma/schema.prisma:557` | skillId, name, category, status, promptText, securityLevel, usageCount 등 |
| SkillRating DB 모델 | `prisma/schema.prisma:581` | 직원별 평점·코멘트 (upsert) |
| 스킬 목록 조회 API | `app/api/skills/route.ts:7` | GET, 카테고리·검색어·status 필터 |
| 스킬 등록 API | `app/api/skills/route.ts:46` | POST, AX_TEAM·C_LEVEL 권한 |
| 스킬 상태 변경 API | `app/api/skills/route.ts:84` | PATCH (draft→active 승인) |
| 스킬 평점 API | `app/api/skills/rate/route.ts` | POST, 별점 1~5 + 한줄 후기 |
| 스킬 시드 데이터 | `app/api/skills/seed/route.ts` | 초기 5종 (ETF NAV점검·리서치요약·메일·회의록·쿼리) |
| 스킬 카탈로그 UI | `app/skills/page.tsx` | 카테고리 필터, 검색, 상세보기, 프롬프트 복사, 평점 |

### 3.2 미구현 (개발 필요)

| 기능 | 우선순위 | 설명 |
|---|---|---|
| **Admin 스킬 등록 UI** | 🔴 높음 | API는 있지만 Admin 화면 없음. 현재 API 직접 호출만 가능 |
| **SKILL.md 파일 임포트** | 🟡 중간 | SKILL.md → DB 자동 파싱·등록 기능 |
| **스킬 리뷰 워크플로우** | 🟡 중간 | draft → AX팀 검토 → active 승인 알림 |
| **GPT 플러그인 연동** | 🟠 높음 | 회사 GPT Custom Instructions 자동 배포 |
| **스킬 사용 통계** | 🟢 낮음 | 부서별·개인별 사용 현황 대시보드 |

---

## 4. 현재까지 완성된 스킬 목록

### 4.1 AX Hub 시드 스킬 (5종) — 이미 DB 등록 가능

| skillId | 이름 | 카테고리 | 보안등급 |
|---|---|---|---|
| `skill-etf-nav-check` | ETF NAV 이상 점검 | ETF운용 | RESTRICTED |
| `skill-report-summarize` | 리서치 보고서 요약 | 리서치 | PUBLIC |
| `skill-email-draft` | 업무 메일 초안 작성 | 업무자동화 | PUBLIC |
| `skill-meeting-minutes` | 회의록 작성 | 업무자동화 | PUBLIC |
| `skill-data-analysis` | 데이터 분석 쿼리 생성 | 데이터분석 | PUBLIC |

### 4.2 ETF 도메인 스킬 (6종) — SKILL.md 파일 완성, DB 미등록

| 파일명 | name | 카테고리 |
|---|---|---|
| `SKILL-1.md` | `01-dashboard-design` | ETF운용 |
| `SKILL-2.md` | `02-dashboard-ui-parts` | ETF운용 |
| `SKILL-3.md` | `03-report-writing` | 문서작성 |
| `SKILL-4.md` | `peer-classification` | ETF운용 |
| `SKILL-5.md` | `etf-domain-rules` | ETF운용 |
| `etf-leaflet-maker-SKILL.md` | `etf-leaflet-maker` | 문서작성 |

### 4.3 마케팅 문서 스킬 (2종) — SKILL.md 파일 완성, DB 미등록

| 파일명 | name | 카테고리 |
|---|---|---|
| `marketing-proposal-SKILL.md` | `marketing-proposal` | 문서작성 |
| `marketing-campaign-brief-SKILL.md` | `marketing-campaign-brief` | 문서작성 |

모든 SKILL.md 파일 위치: `C:\Users\Samsung\Downloads\`

---

## 5. 스킬 카탈로그 카테고리 체계

AX Hub `app/skills/page.tsx`에 정의된 카테고리:

```
전체 | 업무자동화 | ETF운용 | 리서치 | 문서작성 | 데이터분석 | 기타
```

위 카테고리에 맞춰 스킬을 분류한다.

---

## 6. 다음 스킬 후보 (우선순위 순)

| 우선순위 | skillId (안) | 이름 | 카테고리 | 이유 |
|---|---|---|---|---|
| 1 | `skill-etf-main-screen` | ETF 메인화면 정책 | ETF운용 | SKILL-1, SKILL-2에서 참조하는데 파일 없음 |
| 2 | `skill-compliance-review` | 컴플라이언스 검토 | 기타 | 리플렛·광고 심사 자동화 수요 높음 |
| 3 | `skill-fund-commentary` | 운용 코멘트 초안 | ETF운용 | 월간 운용 코멘트 반복 작업 |
| 4 | `skill-ir-deck` | IR 자료 작성 | 문서작성 | IR 자료 표준 구조화 |
| 5 | `skill-dms-report` | DMS 업무 보고서 | 업무자동화 | DMS 반복 보고 자동화 |

---

## 7. 즉시 실행 가능한 작업 목록

### 7.1 오늘 할 수 있는 것 (개발 없이)

1. **시드 스킬 5종 DB 등록**: `POST /api/skills/seed` 호출 한 번
2. **ETF·마케팅 스킬 8종 API 등록**: SKILL.md 내용 → `POST /api/skills` 호출 (수동)

### 7.2 개발 필요한 것 (우선순위 순)

1. **Admin 스킬 등록 UI** — 예상 0.5일
   - `/admin/skills` 페이지 신설
   - 스킬 CRUD 폼 (skillId, name, category, status, promptText 등)
   - 승인 버튼 (draft → active)

2. **SKILL.md 임포트 기능** — 예상 1일
   - 파일 업로드 → 파싱 → DB 등록 자동화
   - `POST /api/admin/skills/import` API

3. **GPT 플러그인 배포 연동** — 예상 별도 논의 필요
   - 회사 GPT 시스템 API 스펙 확인 후 결정

---

## 8. 마일스톤

| 단계 | 목표 | 목표일 | 상태 |
|---|---|---|---|
| M1 | SKILL.md 8종 완성 | 2026-09-11 | ✅ 완료 |
| M2 | 시드 스킬 DB 등록 + Admin 스킬 등록 UI | 2026-09-말 | 🔜 진행 중 |
| M3 | ETF·마케팅 스킬 8종 AX Hub 등록·승인 | 2026-09-말 | 🔜 대기 |
| M4 | 전직원 배포 + 피드백 수집 | 2026-10월 | 🔜 예정 |
| M5 | 스킬 추가 5종 + GPT 플러그인 연동 | 2026-11월 | 🔜 예정 |

---

## 9. 관련 파일 위치

```
SKILL.md 파일:       C:\Users\Samsung\Downloads\*-SKILL.md
AX Hub 프로젝트:     C:\project\ax-team\ax-request-hub\
스킬 카탈로그 UI:    app/skills/page.tsx
스킬 API:            app/api/skills/route.ts
스킬 시드:           app/api/skills/seed/route.ts
이 문서:             docs/gpt-skill-project.md
```
