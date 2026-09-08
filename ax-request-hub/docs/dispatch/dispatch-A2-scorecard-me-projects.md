# [A-2] /me/projects ScoreCard 연결 — 착수 지시서

> 작성: Jarvis / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: dev-standard 트랙 A — 배선 작업
> 선행 완료: A-1(/projects/new 기술표준 체크리스트), B-0(activateAgent 통합)

---

## 배경

`/me/projects` 페이지는 현재 제목·상태 배지·진행바만 표시한다.
AI 심사가 완료된 과제(`scoreCard != null`)는 6개 차원 평가 점수와 기술 표준 미달 사유까지
사용자에게 보여줘야 "내 신청이 왜 이 상태인지"를 알 수 있다.

`ScoreCard.tsx`는 이미 구현 완료된 고아 컴포넌트로, `/me/projects`와 연결만 하면 된다.

---

## 현재 상태 (읽기 완료)

### `src/components/ScoreCard.tsx`

Props:
```ts
interface ScoreCardProps {
  impactScore: number
  roiScore: number
  confidentialityScore: number
  difficultyScore: number
  readinessScore: number
  strategyScore: number
  totalScore: number
  evaluationRationale: string
  techStandardsPassed?: boolean
  techStandardsFailedItems?: string   // JSON string: string[]
}
```
- Tailwind CSS 기반
- Gate 2 기술 표준 배너(green/amber) 이미 구현됨

### `app/api/projects/route.ts` (GET, mine=1)

이미 `include: { scoreCard: true }` 포함. 응답 형태:
```json
{
  "id": "...",
  "title": "...",
  "status": "evaluated",
  "techStandardsPassed": false,
  "techStandardsFailedItems": "[\"API 명세 완료\",\"감사로그 설계\"]",
  "scoreCard": {
    "impactScore": 18.0,
    "roiScore": 15.0,
    "confidentialityScore": 10.0,
    "difficultyScore": 12.0,
    "readinessScore": 8.0,
    "strategyScore": 7.0,
    "totalScore": 70.0,
    "evaluationRationale": "..."
  },
  ...
}
```

API 변경 없음. 프론트엔드만 수정.

---

## 작업 범위

### 파일: `app/me/projects/page.tsx`

**변경 1: import 추가**
```tsx
import { ScoreCard } from '@/src/components/ScoreCard'
```

**변경 2: 토글 상태 추가**

프로젝트 카드별로 ScoreCard 접기/펼치기 상태 관리:
```tsx
const [expandedScores, setExpandedScores] = useState<Set<string>>(new Set())

function toggleScore(id: string) {
  setExpandedScores(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
}
```

**변경 3: 프로젝트 카드 아래 ScoreCard 렌더링**

각 프로젝트 카드 블록(`<div key={p.id}>`) 내부, `PocRequestRow` 위에 삽입:

```tsx
{p.scoreCard && (
  <div>
    <button
      onClick={() => toggleScore(p.id)}
      style={{
        fontSize: 11, color: BLUE, background: 'none', border: 'none',
        cursor: 'pointer', padding: '4px 0', fontWeight: 600,
      }}
    >
      {expandedScores.has(p.id) ? '▲ 평가 결과 닫기' : '▼ AI 평가 결과 보기'}
    </button>

    {expandedScores.has(p.id) && (
      <div style={{ marginTop: 6 }}>
        <ScoreCard
          impactScore={p.scoreCard.impactScore}
          roiScore={p.scoreCard.roiScore}
          confidentialityScore={p.scoreCard.confidentialityScore}
          difficultyScore={p.scoreCard.difficultyScore}
          readinessScore={p.scoreCard.readinessScore}
          strategyScore={p.scoreCard.strategyScore}
          totalScore={p.scoreCard.totalScore}
          evaluationRationale={p.scoreCard.evaluationRationale}
          techStandardsPassed={p.techStandardsPassed}
          techStandardsFailedItems={p.techStandardsFailedItems}
        />
      </div>
    )}
  </div>
)}
```

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | `scoreCard`가 있는 과제에 "AI 평가 결과 보기" 토글 버튼 표시 |
| 2 | 버튼 클릭 시 ScoreCard 펼쳐지고, 재클릭 시 접힘 |
| 3 | 6개 바 차트 + 총점 + evaluationRationale 올바르게 렌더링 |
| 4 | `techStandardsPassed=false`인 경우 amber 배너 + 미달 항목 표시 |
| 5 | `techStandardsPassed=true`인 경우 green 배너 표시 |
| 6 | `scoreCard=null`인 과제에는 버튼 자체 미표시 |

---

## 브랜치

`feat/a2-scorecard-me-projects`

PR: master ← feat/a2-scorecard-me-projects (단독 PR)

---

## 참고 파일

- `src/components/ScoreCard.tsx` — 연결 대상 컴포넌트 (수정 없음)
- `app/me/projects/page.tsx` — 수정 대상
- `app/api/projects/route.ts` — 수정 없음

---

## 다음 작업 (A-2 완료 후)

| 순서 | 트랙 | 내용 |
|---|---|---|
| 다음 | A-3 | `gate2-checklist.tsx` → `/registry/[id]` 연결 — AX팀 검토 |
| 이후 | B-1 | GATE2 하드블록 (A 트랙 완료 후) |
| 병렬 | S-3 | /registry 시스템/도메인 탭 분리 |
