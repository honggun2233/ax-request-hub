# AX Hub 워크플로우 v10 — Decimal 정정 + 인증이슈 승격 + 이의제기 정책 확정

**작성일**: 2026-08-21
**전제 문서**: v3~v9 설계안

---

## 1. 이슈K — Decimal 어노테이션 SQLite 호환 정정

```prisma
model UsageEvent {
  // ❌ v9
  // costKrw  Decimal  @db.Decimal(10, 4)

  // ✅ v10
  costKrw  Decimal   // SQLite에선 REAL로 매핑, @db 어노테이션은 PostgreSQL 전환 시 추가
}
```

Decimal 타입 자체는 유지(부동소수점 오차 방지 목적은 그대로 달성), DB-native 정밀도 지정만 제거합니다. 금액 정밀도가 당장 필요하면 API 레벨에서 Zod `.multipleOf(0.0001)` 등으로 보완합니다.

---

## 2. 트랙 A 확장 — M. middleware.ts 인증 우회 위험 (신규 승격)

기존 코드리뷰(`ax-hub-code-review-v2.md`)에서 확인된 미해결 이슈입니다. v9에서는 P3(챗봇) 보류 사유로만 언급했으나, 이건 **P3와 무관하게 시스템 전체에 걸린 보안 이슈**라 트랙A(구조 수정, P0)로 승격합니다.

| 항목 | 내용 |
|---|---|
| 현재 상태 | `middleware.ts` 부재 — 일부 엔드포인트가 `requireRole()` 체크 없이 노출될 가능성 (엔드포인트별 개별 체크에 의존, 하나라도 누락되면 인증 우회) |
| 조치 방향 | Next.js middleware.ts에서 `/api/*` 전역 인증 게이트를 걸어, 개별 라우트의 `requireRole()` 누락에 의존하지 않는 구조로 전환 |
| GitHub 이슈 트래킹 여부 | **확인 불가 — 인표님 확인 필요.** 트래킹 안 되어 있으면 지금 이슈 등록 권장 |
| 이번 설계와의 관계 | v6 이후 신설된 `/api/intake/*`, `/api/evaluate/*`, `/api/usage-events` 등 신규 엔드포인트도 전부 이 문제에 노출됨 — 신규 API를 추가할수록 노출면이 넓어지는 중 |

**판단**: 이 이슈는 워크플로우 재설계보다 우선순위가 높습니다. 신규 엔드포인트를 계속 늘리고 있는 지금 시점에 middleware.ts부터 막는 게 순서상 맞습니다.

---

## 3. 이의제기 정책 확정 — 게이트별 독립 1회

**정정 사유**: v9의 "프로젝트 전체 누적 2회" 정책은 이슈I가 원래 막으려던 문제(동일 게이트 반복 반려-이의제기 루프)와 무관한 케이스까지 페널티를 줍니다. 서로 다른 게이트에서 각각 정당한 사유로 이의제기하는 것은 막을 이유가 없습니다.

```prisma
model ProjectAppeal {
  // ... 기존 필드 유지 (requesterEmail, reason, status 등) ...

  // ▼ 신규
  gate  String   // GATE1A | GATE1B | GATE2 | GATE3_COMMITTEE — 이 이의제기가 어느 게이트 반려에 대한 것인지
}
```

`Project.appealCount` 필드는 폐기합니다. 별도 카운터를 두지 않고, `AppealCheck` 시점에 다음 쿼리로 판단합니다:

```
AppealCheck 판단 로직:
  existingAppeals = COUNT(ProjectAppeal WHERE projectId = X AND gate = Project.failedGate)
  IF existingAppeals >= 1
    → 이의제기 불가, 자동 status = 'closed'
  ELSE
    → 이의제기 접수 가능
```

**효과**: 같은 게이트에서의 무한 반복은 정확히 1회로 차단되고, 게이트가 4개(1A/1B/2/3위원회)뿐이므로 프로젝트 전체 이의제기도 자연히 최대 4회로 유한합니다. 카운터 필드를 별도로 관리하지 않아 상태 중복(이슈C와 동일 유형의 실수) 위험도 없습니다.

---

## 4. 미결 사항 (v9 대비 갱신)

| 항목 | 내용 |
|---|---|
| middleware.ts GitHub 이슈 등록 여부 | 인표님 확인 필요 — 미등록 시 지금 등록 권장 |
| middleware.ts 조치 담당/일정 | CTO 에이전트 배정 시점 미정 |
| ~~P2 재검토조건, P3 재검토조건~~ | v9와 동일, 단 P3는 이제 M(middleware.ts) 완료가 곧 선결조건 |
| ~~PostgreSQL 전환 시점, 이의제기 SLA, GateFail 통보채널~~ | v9와 동일 미결 |
| ~~Gate1a/1b UI, 표준포맷 버전관리, 확신도 임계값, 엔터프라이즈 API연동, Knox 네이밍~~ | v5~v9와 동일 미결 |

---

## 5. 변경 이력 (v9 → v10)

| 항목 | v9 상태 | v10 조치 |
|---|---|---|
| K | `costKrw Decimal @db.Decimal(10,4)` — SQLite 미호환 어노테이션 포함 | `@db.Decimal(10,4)` 제거, `Decimal` 타입만 유지. PostgreSQL 전환 시 재적용 |
| L | middleware.ts 이슈가 P3 보류사유로만 언급, 별도 조치항목 아님 | 트랙A로 승격(M), 시스템 전체 보안이슈로 재분류. 신규 API 추가할수록 노출면 커지는 중이라 우선순위 상향 |
| appealCount 정책 | 프로젝트 전체 누적 2회 초과 시 차단 | 게이트별 독립 1회로 변경. `Project.appealCount` 폐기, `ProjectAppeal.gate` 필드로 게이트별 이력 추적, 카운트는 쿼리로 판단(별도 카운터 없음) |
