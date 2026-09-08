# [A-1] /projects/new 기술표준 입력 UI 추가 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: dev-standard 트랙 A — 배선 작업
> 선행 완료: B-0(activateAgent 통합, PR #65 머지 + syncGap 3건 소급 복구)

---

## 배경

현재 실제 등록 경로(`/projects/new`)가 `techHas*` 필드를 전혀 다루지 않아서
모든 신청 건의 `techStandardsPassed`가 `false`로 고정됨.
이 상태에서 B-1(GATE2 하드블록)을 넣으면 모든 신청이 즉시 차단되어 서비스 마비.
**A-1이 먼저 열려야 B-1이 의미 있음.**

---

## 작업 범위

### 1. `/projects/new` 마지막 단계에 체크리스트 스텝 추가

AI 신청서 합성(synthesize) 완료 후, 제출 직전에 **"기술 표준 자가 점검"** 단계를 한 스텝으로 추가.

**6개 항목** (각각 체크박스 + 설명 툴팁):

| 필드명 | 레이블 | 설명 (툴팁) |
|---|---|---|
| `techHasApiSpec` | API 명세 완료 | 입력·출력 인터페이스를 문서화했나요? |
| `techHasDataClassification` | 데이터 기밀등급 처리 계획 | 사용 데이터의 PUBLIC/RESTRICTED/CONFIDENTIAL 등급 분류 및 처리 계획을 작성했나요? |
| `techHasAuditLog` | 감사로그 설계 | 주요 이벤트 로그 구조와 보존 기간을 설계했나요? |
| `techHasTestCoverage` | 테스트 커버리지 계획 | 비즈니스 로직 단위 테스트 80% 이상 달성 계획이 있나요? |
| `techHasDataIntegrity` | 데이터 무결성 검증 (R-07) | 입출력 데이터 유효성 검증 절차를 수립했나요? |
| `techHasHumanInLoop` | Human-in-the-loop 절차 (R-09) | AI 결과를 사람이 검토·승인하는 절차를 정의했나요? |

**UX 원칙**:
- 체크하지 않아도 제출 가능 (차단 없음 — 차단은 B-1에서 처리)
- 미충족 항목이 하나라도 있으면 제출 버튼 아래에 안내 문구 표시:
  > "체크되지 않은 항목은 AX팀 검토 단계에서 보완 요청이 올 수 있습니다."
- 전체 체크 시 안내 문구 미표시

### 2. 제출 시 `techHas*` 6개 필드 저장

`/api/projects` POST 요청 body에 6개 필드 추가 포함.
기존 엔드포인트가 이미 이 필드를 받도록 설계되어 있음 — API 변경 없음.

### 3. 기존 컴포넌트 활용

`components/gate2-checklist.tsx`가 이미 6항목을 정의해두고 있음.
현재 어디서도 import되지 않은 고아 컴포넌트 상태 — `/projects/new`에서 import하여 재사용.

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | `/projects/new`에서 6항목 체크 후 제출 시 DB에 `techHas*` 값이 실제로 저장됨 |
| 2 | 전체 `false`로 제출해도 신청이 가능함 (차단 안 됨) |
| 3 | 미충족 항목 있을 때 안내 문구가 표시됨 |
| 4 | 전체 체크 완료 시 안내 문구가 사라짐 |

---

## 참고 문서

- `docs/dev-standard-filtering-gate-spec.md` — 전체 트랙 A/B 설계
- `docs/dev-standard-phase0-1-planning.md` — 기획 배경 및 완료 기준
- `components/gate2-checklist.tsx` — 재사용 대상 컴포넌트

---

## 다음 작업 (A-1 완료 후)

| 순서 | 트랙 | 내용 |
|---|---|---|
| 다음 | A-2 | `ScoreCard.tsx`를 `/me/projects`에 연결 — 미달 사유 표시 |
| 다음 | A-3 | `gate2-checklist.tsx`를 `/registry/[id]`에 연결 — AX팀 검토 |
| 이후 | B-1 | GATE2 하드블록 — A 트랙 완료 후 |
