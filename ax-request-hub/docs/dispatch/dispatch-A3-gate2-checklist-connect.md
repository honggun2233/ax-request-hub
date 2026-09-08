# [A-3] gate2-checklist → /registry AX팀 검토 화면 연결 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: dev-standard 트랙 A — 배선 작업
> 선행 완료: A-1(PR #66), A-2(PR #68)

---

## 배경

`components/gate2-checklist.tsx`가 AX팀이 Gate2 기술표준을 검토·확정하는
컴포넌트로 이미 만들어져 있으나, 어디서도 import되지 않는 고아 컴포넌트 상태.

**코드 검증 중 추가 발견**: 컴포넌트가 처리하는 항목이 **4개**인데
실제 스키마는 **6개**임. 2개가 누락되어 있어 이번 연결 작업 시 같이 수정 필요.

---

## 작업 범위

### 1. `gate2-checklist.tsx` 수정 — 누락된 2항목 추가

현재 4항목 → 6항목으로 확장:

```ts
// components/gate2-checklist.tsx — ITEMS 배열 수정
const ITEMS = [
  { key: 'techHasApiSpec',            label: 'API 명세서',          hint: 'OpenAPI / Swagger 또는 동등한 명세 존재' },
  { key: 'techHasDataClassification', label: '데이터 분류',          hint: '사용 데이터의 기밀등급 분류 완료' },
  { key: 'techHasAuditLogging',       label: '감사 로그',            hint: '입력 · 출력 · 오류 로그 기록 구조 존재' },
  { key: 'techHasTestCoverage',       label: '테스트 커버리지',      hint: '핵심 경로 70% 이상 커버' },
  { key: 'techHasDataQualityCheck',   label: '데이터 무결성 (R-07)', hint: '입출력 데이터 유효성 검증 절차 수립' },  // 신규
  { key: 'techHasHumanInLoop',        label: 'Human-in-the-loop (R-09)', hint: 'AI 결과 검토·승인 절차 정의' },     // 신규
] as const
```

`TechKey` 타입, `Props.initialValues`, PATCH 요청 payload도 6항목으로 자동 확장됨
(as const 기반 타입 추론이라 별도 타입 수정 불필요).

### 2. `/registry` 페이지에 Gate2Checklist 삽입

`app/registry/page.tsx` — 에이전트 상세 패널에서 연결된 Project의
Gate2 체크리스트를 AX팀이 바로 확인·수정할 수 있게 삽입.

**표시 조건**: `agent.lifecycleStage === 'GATE2'`이고 연결된 project가 있을 때

**데이터 조달**:
- `agent.projects[0].project`에 이미 project 데이터가 포함되어 있음
  (`/api/registry` GET이 `projects: { include: { project: true } }`로 내려줌)
- 해당 project에서 `techHas*` 6개 필드와 `techStandardsPassed`, `techStandardsFailedItems` 추출

```tsx
import { Gate2Checklist } from '@/components/gate2-checklist'

// 에이전트 상세 패널 내 적절한 위치에 삽입
{agent.lifecycleStage === 'GATE2' && agent.projects?.[0]?.project && (() => {
  const proj = agent.projects[0].project
  return (
    <Gate2Checklist
      projectId={proj.id}
      initialValues={{
        techHasApiSpec:            proj.techHasApiSpec,
        techHasDataClassification: proj.techHasDataClassification,
        techHasAuditLogging:       proj.techHasAuditLogging,
        techHasTestCoverage:       proj.techHasTestCoverage,
        techHasDataQualityCheck:   proj.techHasDataQualityCheck,
        techHasHumanInLoop:        proj.techHasHumanInLoop,
      }}
      passed={proj.techStandardsPassed}
      failedItems={proj.techStandardsFailedItems}
    />
  )
})()}
```

**주의**: `agent.projects`는 배열이므로 연결된 project가 여러 개일 수 있음.
지금은 첫 번째(`[0]`)만 표시하는 것으로 처리 — 추후 개선 대상.

### 3. API 변경 없음

`/api/projects/[id]/gate2` PATCH는 이미 구현되어 있음.
Gate2Checklist 내부에서 직접 호출하는 구조라 별도 API 작업 불필요.

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | `gate2-checklist.tsx`에 6항목이 모두 표시됨 |
| 2 | `/registry`에서 GATE2 단계 에이전트 상세 보면 체크리스트가 나타남 |
| 3 | 체크박스 변경 후 저장 클릭 시 DB에 반영됨 (`/api/projects/[id]/gate2` PATCH 호출 확인) |
| 4 | GATE2가 아닌 에이전트 상세에는 체크리스트 미표시 |
| 5 | 기존 레지스트리 화면 레이아웃 깨지지 않음 |

---

## 참고 파일

- `components/gate2-checklist.tsx` — 수정 + 연결 대상
- `app/registry/page.tsx` — 삽입 대상
- `app/api/projects/[id]/gate2/route.ts` — PATCH API (수정 불필요)
- `prisma/schema.prisma` — 29~34번 줄: `techHas*` 6개 필드 확인

---

## 다음 작업 (A-3 완료 후)

| 순서 | 트랙 | 내용 |
|---|---|---|
| 다음 | B-1 | GATE2 하드블록 — A 트랙 전체 완료 시 착수 가능 |
| 다음 | B-1b | ACTIVE 직행 옆문 차단 — B-0 PR #65 검증 완료 후 |
