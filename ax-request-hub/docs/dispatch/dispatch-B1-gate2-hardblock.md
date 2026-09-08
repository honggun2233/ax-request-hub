# [B-1] GATE2 기술표준 하드블록 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: dev-standard 트랙 B — 필터링 게이트화
> 선행 완료: A-1(PR #66), A-2(PR #68), A-3(PR #69) 머지 완료 필수
> ⚠ 선행 조건 미충족 시 즉시 차단 — A 트랙 없이 B-1만 넣으면 입력 경로가 없어 모든 신청이 영구 차단됨

---

## 배경

GATE1→GATE2 전환 로직(`app/api/registry/route.ts`)에
`techStandardsPassed` 체크가 현재 전혀 없음. A 트랙으로 입력·검토·제언
화면이 갖춰진 지금, 기술표준 미달 건을 GATE2에서 실제로 차단하는
하드블록을 추가한다.

기존 데이터 하드블록(PROVISIONED 여부)과 **병렬 조건** — 둘 다 통과해야 GATE2 진입.

---

## 작업 범위

### `app/api/registry/route.ts` — GATE2 전환 가드에 기술표준 조건 추가

기존 GATE1→GATE2 데이터 하드블록 바로 뒤에 추가:

```ts
if (lifecycleStage === 'GATE2') {
  // [기존] 데이터 선결조건 하드블록
  const unprovisioned = await prisma.dataRequest.findFirst({
    where: { projectId: agent.projectId ?? '', status: { not: 'PROVISIONED' } },
  })
  if (unprovisioned) {
    return NextResponse.json(
      { error: '연결된 데이터 신청이 아직 승인되지 않았습니다.' },
      { status: 422 }
    )
  }

  // [신규] 기술표준 하드블록
  const project = agent.projectId
    ? await prisma.project.findUnique({
        where: { id: agent.projectId },
        select: { techStandardsPassed: true, techStandardsFailedItems: true },
      })
    : null

  if (!project?.techStandardsPassed) {
    const failedItems: string[] = project?.techStandardsFailedItems
      ? JSON.parse(project.techStandardsFailedItems)
      : []
    return NextResponse.json(
      {
        error: 'GATE2 전환 불가 — 기술표준 미충족',
        failedItems,
        guide: 'AX팀 검토 화면(/registry)에서 Gate2 체크리스트를 완료하거나, 신청자가 /projects/new에서 항목을 보완 후 재제출하세요.',
      },
      { status: 422 }
    )
  }
}
```

**조건 해석**:
- `techStandardsPassed=null` (평가 전) → 422 차단 (AX팀이 gate2 체크리스트를 아직 검토 안 한 상태)
- `techStandardsPassed=false` → 422 차단 + failedItems 목록 반환
- `techStandardsPassed=true` → 통과

---

## B-4 소급 방침 적용

**기존 에이전트에는 영향 없음** — 이미 GATE2를 넘어간 건은
`lifecycleStage`가 GATE2가 아니므로 이 가드에 걸리지 않음.
시행일(머지일) 이후 신규 GATE1→GATE2 전환 시도에만 적용.

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | `techStandardsPassed=false` 에이전트의 GATE2 전환 시도 시 422 반환 |
| 2 | 422 응답에 `failedItems` 배열이 포함됨 |
| 3 | `techStandardsPassed=true` 에이전트는 정상 전환됨 |
| 4 | 기존 GATE2 이상 에이전트는 영향 없음 |
| 5 | 기존 데이터 하드블록(PROVISIONED 체크)이 여전히 작동함 (회귀 없음) |

---

## 참고 파일

- `docs/dev-standard-filtering-gate-spec.md` — B-1 섹션 + 전체 트랙 설계
- `app/api/registry/route.ts` — 수정 대상 (GATE2 전환 가드 위치)

---

## 다음 작업 (B-1 완료 후)

| 순서 | 트랙 | 내용 | 선행 조건 |
|---|---|---|---|
| 다음 | B-1b | ACTIVE 직행 옆문 차단 | B-0(PR #65) 운영 검증 완료 후 **별도 PR** |
| 이후 | B-2 | 인수 신청 기능 신규 개발 | 독립적, 별도 일정 |
