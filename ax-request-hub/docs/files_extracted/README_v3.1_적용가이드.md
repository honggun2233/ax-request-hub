# AX Hub v3.1 코드 패키지 — 적용 가이드 (실제 schema.prisma 정렬판)

> 2026-07-23 총괄 검토에서 수용된 제안의 구현 코드.
> **실제 schema.prisma(608줄) 기준으로 필드명·역할명을 전부 정렬 완료** — 이전 판의 TODO 4곳 해소.
> 협의회는 오프라인 진행 확정: /council은 AX팀 간사가 회의 전 안건을 편성하고
> 회의 후 의결 결과를 기록하는 도구다. 위원 계정·별도 역할 불필요.

## 스키마 정렬 내역 (이번 판에서 확정)

| 항목 | 가정값(이전) | 실제값(적용됨) |
|------|-------------|---------------|
| 관리자 역할 | `ADMIN` | **`AX_TEAM`** (전 API·사이드바 치환) |
| 역할 전체 | 5종 | 6종: EMPLOYEE / DEPT_HEAD / AX_TEAM / C_LEVEL / EXECUTIVE / DATA_PLATFORM |
| AuditLog | action/actorId/targetType/targetId | **entityType / entityId / action / actorEmail / detail** |
| 신청자 식별 | Project.requesterId | **Project.requesterEmail** (알림·이의제기 소유 판정 모두 email 기준) |
| 이의제기 | status DENIED, resultNote | **ACCEPTED / REJECTED**, **reviewNote / reviewedBy / resolvedAt** + evidenceNote 입력 지원 |
| Gate 2 판정 | 가정 | **Project.techStandardsPassed** 확인됨 |
| 에이전트 표시명 | name | **name ?? agentName** (레거시 병존 대응 — displayName 헬퍼) |
| 상정 후보 | devStage만 | devStage IN (GATE3, PILOT_PROVEN) **OR gate3Passed=true** (레거시 병존 대응) |
| projectId | 필수 | **nullable** — 과제 미연결 에이전트는 상정 요건에서 자동 차단 |
| 알림 수신자 | employeeId | **recipientEmail** (스키마 전반의 email 키 관례와 통일) |

CouncilMeeting/CouncilAgendaItem/DataAsset/DataRequest/DataProvision/ProjectAppeal은
이미 스키마에 존재 — 추가 마이그레이션은 **Notification 1개뿐**이다.

## 포함 파일

| 구분 | 파일 |
|------|------|
| 스키마 | `prisma/schema_additions_v3_1.prisma` — Notification (recipientEmail 키) |
| 공통 | `lib/authz.ts` — 세션 이메일 → Employee 조회로 role 확정 (requireRole) |
| 공통 | `lib/lifecycle-labels.ts` — 상태 라벨 이중화 (직원용 쉬운 라벨/6단계) |
| 공통 | `lib/council-eligibility.ts` — 상정 요건 5종 검증 + displayName |
| 공통 | `lib/notify.ts` — 인앱 알림 (Telegram 대체 1단계) |
| API | `app/api/council/meetings`(+`[id]`) · `agenda`(+`[id]/decide`, `[id]/conditions`) |
| API | `app/api/notifications` · `app/api/appeals` (대기 목록) · `app/api/projects/[id]/appeal` (개정) |
| UI | `app/council/page.tsx` · `app/council/[meetingId]/page.tsx` |
| UI | `app/me/projects/page.tsx` · `app/dp/catalog/page.tsx` |
| UI | `components/app-sidebar.tsx` · `status-badge.tsx` · `notification-bell.tsx` · `appeals-panel.tsx` |

## 적용 순서

1. **스키마**: Notification 모델 병합 → `npx prisma migrate dev --name v3_1_notification`
2. **lib 4종 복사** — 남은 확인 지점은 단 하나: `lib/authz.ts`의 `authOptions` import 경로
3. **API·UI 복사** — shadcn 컴포넌트 미설치 시 `npx shadcn@latest add button card dialog input label textarea select checkbox badge popover`
4. **레이아웃**: 루트 layout에 `<AppSidebar role={user.role} />`, 헤더에 `<NotificationBell />`
5. **/dashboard**에 탭 추가: `<AppealsPanel />` (전용 목록 API `/api/appeals` 포함됨)
6. **GET /api/projects 확장**: /me/projects가 기대하는 형태로 응답에 두 필드 추가 —
   `agent`(해당 과제의 AgentRegistry에서 devStage/phase/prodStatus만) ·
   `pendingAppeal`(PENDING/UNDER_REVIEW 이의제기 존재 여부). where에 `?mine=1`이면 `requesterEmail = 세션 email`
7. **미들웨어(proxy.ts)**: `/council/*` → AX_TEAM, `/dp/*` → DATA_PLATFORM|AX_TEAM
8. **레거시 정리**: 사이드바에서 /admin/agents 제외됨 — 마이그레이션 B(레거시 Agent 모델 제거) 후 페이지 삭제

## 동작 검증 시나리오

1. GATE3(또는 gate3Passed) 에이전트 + 파일럿 AgentScore 1건 + prodKpiTarget + 과제 연결
   → /council 회의 등록 → 상정 시 요건 5종 전부 초록
2. 의결 "승인" → /registry 상용 ACTIVE 이동 + 신청자(requesterEmail) 알림 벨 도착
3. 의결 "조건부 승인"(조건 2건) → 조건 전건 체크 순간 자동 ACTIVE + 감사로그 COUNCIL_CONDITIONS_FULFILLED
4. 의결 "반려" — 사유 미입력 시 버튼 비활성 → devStage=GATE3 회귀
5. 직원 계정으로 /me/projects — "정식 운영 심의 중" 등 쉬운 라벨만 노출 (GATE 코드 미노출)
6. 직원이 본인 과제 GET /api/projects/[id]/appeal → 200 (개정 확인), 타인 과제 → 403
7. /dp/catalog에서 G3 자산 등록·비활성 토글 → /data/catalog 노출/숨김 확인

## 설계 메모

- **의결 입력 = 상태 전환** 한 트랜잭션: 오프라인 회의록과 시스템 상태가 어긋날 수 없다.
- **DEFERRED(보류)** 는 상태 유지(COUNCIL_PENDING) — 차기 회의에서 재상정.
- **중복 이의제기 차단**: 진행 중(PENDING/UNDER_REVIEW) 건 존재 시 409.
- **알림은 삼킨다**: notify() 실패가 본 트랜잭션을 막지 않는다.
- trustScore는 v3 필드 우선, 없으면 레거시 operatorTrustScore를 심의 패키지에 사용.
