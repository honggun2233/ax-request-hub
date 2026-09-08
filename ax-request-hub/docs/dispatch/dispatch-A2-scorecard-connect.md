# [A-2] ScoreCard → /me/projects 연결 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: dev-standard 트랙 A — 배선 작업
> 선행 완료: A-1(PR #66 머지), S-1/S-2(PR #67 머지)

---

## 배경

`src/components/ScoreCard.tsx`가 이미 완성된 상태(자동평가 점수 6차원 바 차트 +
Gate2 기술표준 통과/미달 항목 표시 로직 포함)인데 어디서도 import되지 않는
고아 컴포넌트임. `/me/projects`가 이미 `scoreCard: true`로 include해서
API 응답에 데이터를 내려주고 있어 **연결만 하면 바로 동작함**.

목적: 신청자가 자신의 과제 자동평가 결과와 기술표준 미달 항목을 직접 확인할 수 있게 함.

---

## 작업 범위

### 1. `/me/projects` 과제 카드에 ScoreCard 표시

`app/me/projects/page.tsx` — 각 과제 카드에 ScoreCard 컴포넌트 추가.

**표시 조건**: `project.scoreCard`가 존재할 때만 렌더링
(평가 전 신청 건에는 안 보이는 게 자연스러움)

**표시 위치**: 과제 카드 내 ProgressBar 아래, 기존 링크 버튼 위

```tsx
import { ScoreCard } from '@/src/components/ScoreCard'

// 과제 카드 내부
{project.scoreCard && (
  <ScoreCard
    impactScore={project.scoreCard.impactScore}
    roiScore={project.scoreCard.roiScore}
    confidentialityScore={project.scoreCard.confidentialityScore}
    difficultyScore={project.scoreCard.difficultyScore}
    readinessScore={project.scoreCard.readinessScore}
    strategyScore={project.scoreCard.strategyScore}
    totalScore={project.scoreCard.totalScore}
    evaluationRationale={project.scoreCard.evaluationRationale}
    techStandardsPassed={project.scoreCard.techStandardsPassed ?? undefined}
    techStandardsFailedItems={project.scoreCard.techStandardsFailedItems ?? undefined}
  />
)}
```

### 2. API 변경 없음

`GET /api/projects?mine=1`이 이미 `include: { scoreCard: true }`로
ScoreCard 데이터를 포함해서 응답함. 추가 작업 불필요.

---

## ScoreCard 컴포넌트 동작 (참고)

이미 구현된 내용이라 수정 불필요:

- 6차원 점수를 가로 바 차트로 시각화 (임팩트 25점 + ROI 25점 + 기밀등급 15점 + 난이도 15점 + 준비도 10점 + 전략정합성 10점)
- `techStandardsPassed=true` → 초록색 "Gate 2 기술 표준: 통과" 배지
- `techStandardsPassed=false` → 주황색 "보류 — [미달 항목 목록]" 배지
- `techStandardsPassed=undefined` → 미표시 (평가 전 상태)

**A-1과의 연결**: 신청자가 A-1에서 입력한 `techHas*` 값이 자동평가 후
`techStandardsFailedItems`에 JSON으로 기록됨 → 여기서 항목별로 표시됨.

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | 평가 완료된 과제 카드에 ScoreCard가 표시됨 |
| 2 | 기술표준 미달 항목이 있으면 주황색 배지에 항목명이 나열됨 |
| 3 | 기술표준 통과 시 초록색 "통과" 배지가 표시됨 |
| 4 | 평가 전 과제(scoreCard 없음)에는 ScoreCard가 미표시됨 |
| 5 | 기존 카드 UI 레이아웃 깨지지 않음 |

---

## 참고 파일

- `src/components/ScoreCard.tsx` — 연결 대상 컴포넌트 (수정 불필요)
- `app/me/projects/page.tsx` — 수정 대상
- `app/api/projects/route.ts` — 23번 줄: `scoreCard: true` include 확인

---

## 다음 작업 (A-2 완료 후)

| 순서 | 트랙 | 내용 |
|---|---|---|
| 다음 | A-3 | `gate2-checklist.tsx`를 `/registry/[id]`에 연결 — AX팀 검토 화면 |
| 이후 | B-1 | GATE2 하드블록 — A 트랙 전체 완료 후 |
