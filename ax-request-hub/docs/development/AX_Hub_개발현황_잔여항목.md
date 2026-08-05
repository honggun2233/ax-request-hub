# AX Hub — 개발 현황 및 잔여 항목

| 항목 | 내용 |
|------|------|
| 문서번호 | AX-DEV-2026-001 |
| 버전 | v1.1 |
| 작성일 | 2026-07-29 |
| 최종 수정 | 2026-08-03 |
| 기준 브랜치 | master + feat/external-integrations (PR #12) |

---

## 정책 결정 반영 (2026-08-03)

> 이 섹션은 2026-08-03 검토에서 확정된 개발 방향 변경 사항을 기록합니다.

### 결정 1 — 과제 신청 에이전트: 챗봇 → 키인(Form) 방식 확정

| 항목 | 내용 |
|------|------|
| 배경 | 개발팀 사용 LLM = Qwen (로컬 온프레미스). 챗봇 방식 구현 시 개발기간 증가 |
| 결정 | 과제 신청은 키인(Form) 방식으로 확정. `/submit` 폼 강화 |
| `/chat` 처리 | 과제 신청 용도 비활성화. 일반 AI 채팅 기능 유지 여부는 별도 검토 |
| Qwen 연동 범위 | 폼 제출 후 백엔드 6차원 자동 스코어링에만 적용 (챗봇 UI 없음) |

### 결정 2 — LLM Provider 추상화 (신규 개발 항목)

| 항목 | 내용 |
|------|------|
| 현황 | Claude API 하드코딩 (`/api/evaluate/[id]`, `/api/chat`) |
| 변경 | LLM provider 추상화 레이어 추가 → Claude / Qwen 전환 가능하게 |
| 신규 파일 | `lib/llm.ts` (provider 인터페이스 + Claude·Qwen 구현체) |
| 우선순위 | P1 (배포 전 완료 필요) |

### 결정 3 — 정보전략팀 역할: 시스템 DB 역할 추가 제외

| 항목 | 내용 |
|------|------|
| 배경 | Gate 2 보안 검토에 정보전략팀 개입 확정 (거버넌스 v2026-08-03) |
| 시스템 처리 방식 | 정보전략팀 별도 DB 역할(INFORMATION_SECURITY) **추가하지 않음** |
| 대신 구현 | 고위험·기밀 과제의 Gate 2 단계에 "정보전략팀 검토 대기" 플래그(`infoSecReviewRequired: Boolean`) 표시 |
| 오프라인 절차 | 정보전략팀 검토는 시스템 외부 (별도 체크리스트 + 서명) — AX Hub는 플래그 표시만 담당 |

---

## 범례

| 기호 | 의미 |
|------|------|
| ✅ | 구현 완료 (master 반영) |
| 🔄 | PR 완료, 머지 대기 (PR #12) |
| ⚠️ | 구현됐으나 개선 필요 |
| ❌ | 미구현 |

---

## Phase 1 — 핵심 기능 (✅ 완료)

### 1-1. 과제 신청·평가 시스템
| 기능 | 상태 | 비고 |
|------|------|------|
| 과제 신청 폼 (`/submit`) | ✅ | Gate 2 자가점검 포함 |
| Claude API 6차원 자동 스코어링 | ✅ | `POST /api/evaluate/[id]` |
| 70점 기준 자동승인 / 에스컬레이션 | ✅ | G3 자동 에스컬레이션 |
| AX팀 수동 승인/반려 | ✅ | `POST /api/approve/[id]` |
| 과제 상태 조회 (`/status/[id]`) | ✅ | 스코어카드 시각화 포함 |
| 이의신청 (`/admin/appeals`) | ✅ | |

### 1-2. 에이전트 이중 라이프사이클
| 기능 | 상태 | 비고 |
|------|------|------|
| AgentRegistry 모델 (devStage + prodStatus) | ✅ | |
| 레지스트리 파이프라인 UI (`/registry`) | ✅ | 클릭 필터 + 단계 전환 |
| Gate 1/2/3 단계 전환 | ✅ | |
| 협의회 의결 → 상용 전환 | ✅ | |
| 에이전트 퇴역 (DEPRECATED → RETIRED) | ✅ | |
| AX 프로젝트 M:N 연결 | ✅ | AgentProjectLink |

### 1-3. 데이터 프로비저닝
| 기능 | 상태 | 비고 |
|------|------|------|
| 데이터 카탈로그 직원 조회 (`/data/catalog`) | ✅ | |
| 데이터 이용 신청 (ACCESS / NEW) | ✅ | `POST /api/data/requests` |
| 데이터플랫폼팀 승인 처리 (`/dp/requests`) | ✅ | |
| G3 데이터 이중 승인 흐름 | ✅ | |
| DataProvision 이용 기간 관리 | ✅ | |
| 내 데이터 신청 현황 (`/me/data`) | ✅ | |

### 1-4. AI 도구·토큰 관리
| 기능 | 상태 | 비고 |
|------|------|------|
| TokenPolicy CRUD (GLOBAL/LEVEL/EMPLOYEE) | ✅ | |
| 레벨별 서비스 배분 정책 (DistributionPolicy) | ✅ | |
| 부서별 AI 도구 쿼터 (DepartmentQuota) | ✅ | |
| 부서장 도구 배정 (`/dept/tools`) | ✅ | |
| 직원 도구 신청 (`/me/tools`) | ✅ | |
| Claude 토큰 실시간 수집 (`/api/chat`) | ✅ | UsageRecord 실시간 upsert |
| 토큰 경고 알림 (UsageAlert) | ✅ | DB 저장, Knox 연동은 PR #12 |

### 1-5. AI 리터러시 레벨
| 기능 | 상태 | 비고 |
|------|------|------|
| L0~L4 레벨 정의 및 혜택 관리 | ✅ | |
| 레벨 신청 폼 (`/me/level`) | ✅ | |
| AX팀 레벨 승인 (`/admin/literacy`) | ✅ | |
| 리터러시 교육 콘텐츠 (`/me/literacy`) | ✅ | |

### 1-6. AI 위원회
| 기능 | 상태 | 비고 |
|------|------|------|
| 협의회 회의 생성/관리 | ✅ | |
| 안건 상정 · 심의 조건 체크 | ✅ | |
| 승인/반려/조건부 의결 | ✅ | |
| 의결 → 에이전트 라이프사이클 자동 업데이트 | ✅ | |

### 1-7. 직원 관리
| 기능 | 상태 | 비고 |
|------|------|------|
| 직원 CRUD (`/admin/employees`) | ✅ | |
| CSV 내보내기 | ✅ | |
| 역할 변경 (`PATCH /api/admin/users/[id]/role`) | ✅ | |

### 1-8. AI 채팅 & 스킬
| 기능 | 상태 | 비고 |
|------|------|------|
| Claude 기반 AI 채팅 (`/chat`) | ✅ | 스트리밍 |
| 자연어 과제 조회 (`/api/nl-query`) | ✅ | |
| AI 스킬 라이브러리 (`/skills`) | ✅ | 별점 평가 포함 |

### 1-9. 거버넌스 문서
| 기능 | 상태 | 비고 |
|------|------|------|
| 거버넌스 문서 뷰어 (`/docs`) | ✅ | 마크다운 렌더링 |
| 문서 버전 관리 | ✅ | |

### 1-10. 감사 로그 & 경영진
| 기능 | 상태 | 비고 |
|------|------|------|
| AuditLog (모든 주요 액션 기록) | ✅ | |
| 경영진 대시보드 (`/executive`) | ✅ | |
| 관리자 콘솔 요약 (`/admin`) | ✅ | |

---

## Phase 2 — 외부 연동 (🔄 PR #12, 머지 대기)

| 기능 | 상태 | 비고 |
|------|------|------|
| **WS-A** Snowflake 메타데이터 미러 (DataAsset) | 🔄 | READONLY 연결, POST /api/admin/catalog/sync |
| **WS-B** OpenAI Usage API 배치 수집 | 🔄 | `scripts/collect-llm-usage.ts`, Gemini는 stub |
| **WS-C** Knox 알림 추상화 레이어 (`lib/notify.ts`) | 🔄 | NOTIFY_CHANNEL=knox|console 분기 |
| **WS-D** PostgreSQL 전환 (`prisma/schema.prisma`) | 🔄 | 서버 연결 후 `migrate deploy` 필요 |
| **WS-D** 온프레미스 배포 스크립트 (`scripts/deploy.sh`) | 🔄 | PM2 + Nginx 구성 |

**PR #12 머지 전 체크리스트:**
- [ ] `console-summary/route.ts:56` tsc 에러 수정
- [ ] Knox 실제 사내 API URL 환경변수 설정
- [ ] PostgreSQL 서버 인프라 팀 협의
- [ ] `prisma migrate deploy` 검증

---

## Phase 3 — 잔여 항목 (❌ 미구현)

### 3-0. 키인 방식 전환 (2026-08-03 확정, 최우선)

| 기능 | 우선순위 | 내용 |
|------|----------|------|
| LLM provider 추상화 레이어 | P1 | `lib/llm.ts` 신규 — Claude/Qwen 전환 인터페이스. `evaluate/[id]`·`chat` API 연결 분리 |
| Qwen 스코어링 연동 | P1 | 6차원 자동 스코어링을 Qwen 엔드포인트(온프레미스)로 호출. provider 추상화 완료 후 구현 |
| `/chat` 과제신청 기능 비활성화 | P2 | 과제 신청 목적 챗봇 경로 제거. 일반 AI 채팅 유지 여부는 별도 결정 |
| Gate 2 정보전략팀 플래그 | P2 | AgentRegistry에 `infoSecReviewRequired: Boolean` 필드 추가. 고위험·기밀 과제 자동 체크 |
| `/submit` 폼 UX 개선 | P3 | 키인 방식 확정에 따른 과제 신청 폼 항목 명확화 (필수/선택 구분, 도움말 텍스트) |

### 3-1. 외부 연동 후속 (PR #12 이후)

| 기능 | 우선순위 | 내용 |
|------|----------|------|
| Snowflake 자동 배치 동기화 | P1 | 현재는 수동 트리거. 일 1회 cron 또는 Next.js scheduled job 필요 |
| Gemini Usage API 수집 | P1 | GCP 서비스 계정 + Google Cloud Billing API 구현 (`GOOGLE_APPLICATION_CREDENTIALS` 환경 필요) |
| Knox 실제 알림 전송 테스트 | P1 | Knox 사내 API URL 확정 후 end-to-end 검증 |
| costKrw 원화 환산 | P2 | UsageRecord.costKrw 현재 0. 환율 API 또는 수동 단가 기준 필요 |

### 3-2. 기능 개선

| 기능 | 우선순위 | 내용 |
|------|----------|------|
| 과제 스코어링 히스토리 | P1 | 재평가 시 ScoreCard 이력 누적 (현재는 덮어쓰기) |
| 알림 실시간 전달 | P1 | 현재 인앱 알림은 DB 폴링. Knox 연동 후 push 방식으로 전환 |
| 에이전트 KPI 자동 집계 | P2 | 현재 수동 입력. 실운용 시스템 연동 필요 |
| 데이터 이용 만료 자동 처리 | P2 | DataProvision.expiresAt 만료 시 자동 EXPIRED 전환 (cron) |
| 레벨 신청 자동 심사 | P3 | 현재 수동 승인. 리터러시 점수 기반 자동화 가능 |

### 3-3. 운영·배포

| 기능 | 우선순위 | 내용 |
|------|----------|------|
| 사내 서버 배포 | P0 | PostgreSQL + PM2 + Nginx 실서버 적용 (인프라 팀 협의 필요) |
| LDAP/AD 연동 (직원 자동 동기화) | P2 | 현재 Employee 테이블 수동 관리. HR 시스템 연동은 제외 결정 |
| 정기 배치 스케줄러 | P2 | Snowflake 동기화, Usage 수집, 만료 처리 자동화 |
| 모니터링 (앱 로그, 에러 알람) | P2 | PM2 로그 + Knox 에러 알림 연동 |

### 3-4. tsc 에러 잔여 (수정 필요)

| 파일 | 에러 | 우선순위 |
|------|------|----------|
| `app/api/admin/console-summary/route.ts:56` | TS2352 타입 캐스팅 오류 | P1 (PR #12 머지 블로커) |

---

## 요약

| 구분 | 항목 수 |
|------|---------|
| ✅ Phase 1 완료 | ~70개 기능 |
| 🔄 Phase 2 PR 대기 | 5개 |
| ❌ Phase 3-0 키인 전환 (신규) | 5개 |
| ❌ Phase 3 잔여 | 12개 |

**다음 우선 실행 순서:**
1. PR #12 머지 (`console-summary` tsc 수정 포함)
2. **LLM provider 추상화 + Qwen 연동** (3-0, 배포 전 완료)
3. 사내 서버 배포 (PostgreSQL + Knox URL 확정 후)
4. Snowflake 자동 배치 + Gemini Usage API
5. 알림 실시간 전달 + 데이터 만료 자동화

**개발 제외 항목 (명시):**
- 정보전략팀 DB 역할(INFORMATION_SECURITY) 추가 → 제외. 오프라인 절차로 처리
- `/chat` 기반 과제신청 에이전트 → 키인 방식으로 대체

---

*최초 작성: 2026-07-29 | v1.1 수정: 2026-08-03 (키인 방식 확정, LLM 추상화, 정보전략팀 처리 방식)*
