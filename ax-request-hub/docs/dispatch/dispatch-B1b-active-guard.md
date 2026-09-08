# [B-1b] ACTIVE 직행 옆문 차단 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: dev-standard 트랙 B — 필터링 게이트화
> ⚠ 머지 조건: PR #65(B-0) 운영 배포 완료 + syncGap 0건 확인 후에만 머지할 것
> ⚠ 별도 PR 필수: B-1(PR #70)과 같은 PR에 묶지 말 것

---

## 배경

`PATCH /api/registry`의 ACTIVE 전환 분기(79~85번 줄)가 현재
`operatorTrustScore`만 있으면 `checkProdEligibility`(상용전환 5요건)를
거치지 않고 바로 ACTIVE로 전환됨.

위원회 상정 경로(`/api/council/agenda`)는 안건 상정 시점에
`checkProdEligibility` 422 하드블록이 살아있는데,
이 직행 경로(운용역 직접 전환)에만 동일 검증이 없는 상태.

DB 조회 결과 악용 사례 0건 확인 — "구멍 막기"가 아니라 **예방적 조치**.

---

## 작업 범위

### `app/api/registry/route.ts` — ACTIVE 전환 분기에 5요건 가드 추가

B-0이 만든 ACTIVE 분기(79번 줄 기준) 앞에 `checkProdEligibility` 체크를 삽입:

```ts
import { checkProdEligibility } from '@/lib/council-eligibility'

// ACTIVE 전환 — B-1b: 5요건 사전 검증 (위원회 경로와 동일 기준)
if (lifecycleStage === 'ACTIVE') {
  const { eligible, checks } = await checkProdEligibility(id)
  if (!eligible) {
    return NextResponse.json(
      {
        error: '상용전환 요건 미충족 — ACTIVE 전환 불가',
        checks,
        guide: '위원회 상용전환 상정(/council)을 통한 정식 승인 경로를 이용하세요.',
      },
      { status: 422 }
    )
  }

  // 요건 통과 후 activateAgent (B-0 공용 함수 그대로 유지)
  const agent = await prisma.$transaction(async (tx) => {
    return activateAgent(tx, id, { operatorTrustScore, operatorComment, sam30dAccuracy })
  })
  return NextResponse.json(agent)
}
```

**주의**: `checkProdEligibility(id)` — agentId를 받는 함수.
`id`는 이미 route에서 파싱된 agentId값이라 그대로 사용.

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | 5요건 미충족 에이전트에 `operatorTrustScore`만 넣어 ACTIVE 시도 시 422 반환 |
| 2 | 422 응답에 `checks` 배열(항목별 passed/failed)이 포함됨 |
| 3 | 5요건 통과 에이전트는 기존과 동일하게 ACTIVE 전환됨 |
| 4 | 위원회 경로(`/api/council/agenda/decide`)는 영향 없음 (별도 파일) |
| 5 | B-0의 `activateAgent()` 호출 구조가 그대로 유지됨 (회귀 없음) |

---

## 참고 파일

- `app/api/registry/route.ts` — 수정 대상 (79번 줄 ACTIVE 분기)
- `lib/council-eligibility.ts` — `checkProdEligibility(agentId)` 재사용
- `docs/dev-standard-filtering-gate-spec.md` — B-1b 섹션

---

## 다음 작업 (B-1b 완료 후)

| 순서 | 트랙 | 내용 |
|---|---|---|
| 다음 | S-3 | `/registry` 시스템/도메인 탭 구분 + 시스템 에이전트 수정·삭제 비활성화 |
| 다음 | S-4 | `/projects/new` 공통 에이전트 선택 체크박스 (A-1 작업과 인접) |
| 별도 | B-2 | 인수 신청 기능 신규 개발 (독립적, 별도 일정) |
