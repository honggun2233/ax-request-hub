# AX Hub 워크플로우 v23 — 이슈KK/LL 반영

**작성일**: 2026-08-21
**전제 문서**: v3~v22 설계안

---

## 1. 이슈KK — 롤업 방식: 전체 SUM으로 확정

```ts
// rollupCurrentMonthToUsageRecord() — 전체 SUM 방식
async function rollupCurrentMonthToUsageRecord() {
  const yearMonth = getCurrentYearMonth()
  const grouped = await db.usageRecordDaily.groupBy({
    by: ['employeeId', 'service'],
    where: { date: { startsWith: yearMonth } },  // "2026-08" 프리픽스로 이번 달 전체
    _sum: { tokenUsed: true, costKrw: true },
  })
  for (const g of grouped) {
    await db.usageRecord.upsert({
      where: { employeeId_service_yearMonth: { employeeId: g.employeeId, service: g.service, yearMonth } },
      update: { tokenUsed: g._sum.tokenUsed, costKrw: g._sum.costKrw },
      create: { employeeId: g.employeeId, service: g.service, yearMonth, tokenUsed: g._sum.tokenUsed, costKrw: g._sum.costKrw },
    })
  }
}
```

**판단 근거**: 직원 수 × 3서비스 × 30일이라 봐야 수천 행 수준이라 매일 전체 재계산해도 성능 문제가 없고, 벤더가 과거 일자 데이터를 소급 정정하는 경우(흔히 발생)도 다음 배치에서 자동으로 반영됩니다. 증분 방식은 이 소급 정정을 못 잡는 게 명확한 단점이라 선택하지 않습니다.

---

## 2. 이슈LL — 로컬 개발환경 우회, 이중 안전장치로 설계

**이 코드는 원래 발견했던 사고(`auth.ts`가 "누구나 관리자로 로그인")와 같은 종류의 위험을 새로 만들 수 있는 지점입니다.** 대체 로직을 넣으면서 같은 실수를 반복하지 않도록 안전장치를 이중으로 겁니다.

```ts
// auth.ts — authorize() 내부
async authorize(credentials) {
  // ▼ 개발환경 우회 — 이중 안전장치
  if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_USER) {
    // 안전장치1: NODE_ENV가 명시적으로 'development'일 때만
    // 안전장치2: 별도 env var(DEV_BYPASS_USER)도 명시적으로 설정돼 있어야 함 — 둘 중 하나만으론 안 됨
    console.warn(`⚠️  DEV BYPASS ACTIVE — logging in as ${process.env.DEV_BYPASS_USER}. 프로덕션 배포 전 반드시 제거 확인.`)
    const emp = await db.employee.findUnique({ where: { email: process.env.DEV_BYPASS_USER } })
    return emp ? toSessionUser(emp) : null
  }

  // 안전장치3: 빌드/부팅 시점에 이 조합이 프로덕션에서 활성화되지 않는지 어설션
  if (process.env.NODE_ENV === 'production' && process.env.DEV_BYPASS_USER) {
    throw new Error('DEV_BYPASS_USER가 프로덕션 환경에 설정되어 있습니다. 즉시 제거하세요.')
  }

  // ── 이하 실제 SSO/LDAP 검증 로직 ──
  // ...
}
```

**3중 방어**: (1) `NODE_ENV`와 별도 env var 둘 다 필요 — 배포 스크립트가 실수로 `DEV_BYPASS_USER`만 남겨도 `NODE_ENV=production`이면 안 걸림 (2) 반대로 프로덕션에서 이 변수가 살아있으면 조용히 무시하지 않고 **부팅 자체를 실패시켜서** 배포 파이프라인에서 바로 드러나게 함 (3) 활성화 시 콘솔 경고로 로컬 개발자도 인지하게 함.

---

## 3. 미결 사항 (v22 대비 갱신)

| 항목 | 내용 |
|---|---|
| ~~롤업 방식(KK)~~ | 해결됨 |
| ~~로컬 개발환경 우회(LL)~~ | 해결됨 — 이중 안전장치 포함 인증 통합 티켓 범위에 편입 |
| **인증 통합 티켓 착수** (auth.ts + middleware.ts + 개발환경 우회) | ★★★ 최우선, 유일한 P0 |
| Claude Enterprise Analytics API 키 발급 | v21과 동일 미결 |

---

## 4. 변경 이력 (v22 → v23)

| 항목 | v22 상태 | v23 조치 |
|---|---|---|
| KK | 롤업 방식(전체 SUM vs 증분) 미명세 | 전체 SUM으로 확정, groupBy 기반 구현 예시 명시 |
| LL | SSO 연동 전 로컬 개발 로그인 불가 문제, 우회 설계 없음 | `NODE_ENV`+`DEV_BYPASS_USER` 이중 조건 + 프로덕션 자동차단 어설션으로 3중 방어 설계. 인증 통합 티켓(v22 §3) 범위에 포함 |
