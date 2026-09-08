# [A-4 + C-1/C-2 + C-3 + C-5 Step1] 통합 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: 기술부채 + 보안 + 거버넌스 — 독립 작업들, PR 분리 권장

---

## A-4. 거버넌스 문서 저장

`docs/governance/l3-가이드라인/[가이드라인]_전사AI과제개발표준_ax-dev-2026-002.md`를
`AI-STD-2026-006-v1.4-개정안.md` 내용으로 교체.

**주의**: 이 파일은 결재 상신용 초안임. 코드 변경 없음, 문서 파일만 교체.
실제 결재는 인표님이 AX/PI센터장 결재선을 통해 진행.

---

## C-1/C-2. TypeScript 타입 정리 + 고아 페이지 삭제 (단일 PR)

`dispatch-C1-C2-typescript-cleanup.md` 참조. 핵심:

1. `types/next-auth.d.ts` — `employeeId: string` 3줄 추가 (User/Session/JWT)
2. `lib/auth.ts` — `as any` 9개 제거 (타입 선언 후 자동 해소)
3. `app/admin/audit/page.tsx` + 디렉토리 삭제

완료 조건: `npx tsc --noEmit` 에러 0건

---

## C-3. Snowflake/Glue 외부 권한 추적 (단일 PR)

`dispatch-C3-snowflake-external-grant.md` 참조.

**스키마 사전 확인 완료**:
- `AgentDataLink` 모델 존재 (`agentId`, `dataAssetId` 필드 확인)
- `DataRequest.assetId → DataAsset` 연결 확인
- C-3 지시서의 include 경로 그대로 사용 가능

구현 4단계:
1. `DataProvision`에 `externalGranted/At/By` 필드 추가 + 마이그레이션
2. 승인 시 `sourceSystem`이 SNOWFLAKE/AWS_GLUE면 데이터플랫폼팀 Knox 알림
3. `POST /api/dp/provisions/[id]/external-grant` 신규 API
4. Policy Gateway에 미확인 외부 프로비전 → DEGRADED 체크 추가

Policy Gateway 삽입 위치 — 기존 DEGRADED 체크(성능저하) 직후, 사용량 체크 전:
```ts
// lib/gateway/policy.ts — ALLOW 판정 직전
const agentDataLinks = await prisma.agentDataLink.findMany({
  where: { agentId },
  include: {
    dataAsset: {
      include: {
        requests: {
          where: { status: 'PROVISIONED' },
          include: { provision: true },
        },
      },
    },
  },
})
const hasUnconfirmedExternal = agentDataLinks.some(link =>
  ['SNOWFLAKE', 'AWS_GLUE'].includes(link.dataAsset.sourceSystem) &&
  link.dataAsset.requests.some(r => r.provision && !r.provision.externalGranted)
)
if (hasUnconfirmedExternal) {
  logDecision(agentId, employeeId, 'DEGRADED', '외부 데이터 소스 접근 권한 미확인')
  return { decision: 'DEGRADED', reason: '외부 데이터 소스(Snowflake/Glue) 접근 권한이 확인되지 않았습니다.' }
}
```

---

## C-5 Step 1. Employee.password 현황 DB 조회 (보고용, 코드 변경 없음)

운영 DB에서 읽기 전용으로 아래 조회 실행 후 결과를 인표님께 보고:

```ts
// 전체 직원 패스워드 현황
const total = await prisma.employee.count()
const emptyPw = await prisma.employee.count({ where: { password: '' } })
const bcryptPw = await prisma.employee.count({
  where: { password: { startsWith: '$2b$' } }
})
const otherPw = total - emptyPw - bcryptPw

console.log({
  total,
  empty: emptyPw,        // TEMP_AUTH_PASSWORD로 인증 중인 계정
  bcrypt: bcryptPw,      // 개인 bcrypt 해시 설정됨
  other: otherPw,        // 기타 (예상치 못한 형식)
  tempAuthRisk: emptyPw > 0 ? '⚠ 공유 패스워드 사용 중' : '✅ 없음'
})
```

**Step 2(실제 전환)는 이 결과 확인 후 인표님 승인 받아 별도 진행.**

---

## PR 분리 가이드

| PR | 포함 항목 | 머지 조건 |
|---|---|---|
| PR A | A-4 문서 교체 | 즉시 (코드 변경 없음) |
| PR B | C-1/C-2 타입 정리 + 고아 페이지 | 즉시 |
| PR C | C-3 Snowflake 추적 | 즉시 |
| — | C-5 Step1 DB 조회 | 코드 PR 아님, 결과 보고만 |
