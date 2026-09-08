# [C-3] Snowflake/AWS Glue 외부 데이터 연동 추적 — 착수 지시서 (옵션 B)

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: 데이터 거버넌스 — 반자동화 (직접 SDK 연동 없음)
> 근거: snowflake-glue-integration-roadmap.md — 옵션 B 확정
> 선행 조건: 없음 (독립)

---

## 배경

`DataAsset.sourceSystem='SNOWFLAKE'|'AWS_GLUE'`인 데이터가 프로비전 승인돼도
실제로 외부 시스템 접근 권한이 부여됐는지 AX Hub가 추적하지 않음.
"기록 시스템"에 머물고 있어 거버넌스 원칙 위반.

**Snowflake SDK 직접 연동은 하지 않음** — 보안 심의 필요, 시기 부적절.
대신 데이터플랫폼팀이 수동으로 외부 권한을 처리하고,
AX Hub가 그 완료 여부를 추적하는 구조로 거버넌스 원칙 충족.

---

## 작업 범위

### 1. 스키마 — `DataProvision`에 외부 권한 추적 필드 추가

```prisma
model DataProvision {
  // 기존 필드 유지
  externalGranted    Boolean   @default(false)
  externalGrantedAt  DateTime?
  externalGrantedBy  String?   // 처리한 담당자 email
}
```

### 2. 승인 시 Knox 알림 — 데이터플랫폼팀에 처리 요청

`app/api/dp/requests/[id]/route.ts` (또는 DataProvision 생성 지점) — 승인 완료 후:

```ts
import { notify } from '@/lib/notify'

// DataProvision 생성 후 sourceSystem 확인
const asset = await prisma.dataAsset.findUnique({
  where: { id: provision.request.assetId },
  select: { sourceSystem: true, externalId: true, name: true },
})

if (['SNOWFLAKE', 'AWS_GLUE'].includes(asset?.sourceSystem ?? '')) {
  const dpEmails = await prisma.employee.findMany({
    where: { role: 'DATA_PLATFORM' },
    select: { email: true },
  }).then(r => r.map(e => e.email))

  await notify(
    {
      type: 'DATA_REQUEST_UPDATE',
      title: `외부 데이터 접근 권한 처리 필요 — ${asset!.name}`,
      body: `${asset!.sourceSystem} [${asset!.externalId}] 접근 권한을 수동으로 부여해주세요.`,
      link: `/dp/requests`,
      metadata: { provisionId: provision.id, sourceSystem: asset!.sourceSystem },
    },
    dpEmails,
  )
}
```

### 3. `/dp/requests` UI — 외부 권한 미확인 건 강조 + 확인 버튼

`app/dp/requests/page.tsx`:

- `sourceSystem`이 SNOWFLAKE/AWS_GLUE이고 `externalGranted=false`인 프로비전에 주황색 배지:
  ```
  ⚠ Snowflake 권한 처리 필요
  ```
- "외부 권한 처리 완료" 버튼 (DATA_PLATFORM 권한만):
  ```ts
  // PATCH /api/dp/provisions/[id]/external-grant
  await prisma.dataProvision.update({
    where: { id },
    data: {
      externalGranted: true,
      externalGrantedAt: new Date(),
      externalGrantedBy: auth.user.email,
    },
  })
  // AuditLog 기록
  await prisma.auditLog.create({
    data: {
      entityType: 'DataProvision',
      entityId: id,
      action: 'EXTERNAL_GRANT_CONFIRMED',
      actorEmail: auth.user.email,
      detail: JSON.stringify({ sourceSystem: provision.request.asset.sourceSystem }),
    },
  })
  ```

### 4. Policy Gateway — 외부 권한 미확인 시 DEGRADED

`lib/gateway/policy.ts` — 기존 ALLOW 판정 전에 추가:

```ts
// 에이전트가 사용하는 데이터 중 외부(Snowflake/Glue) 미확인 건 체크
const agentDataLinks = await prisma.agentDataLink.findMany({
  where: { agentRegistryId: agentId },
  include: {
    dataAsset: {
      include: {
        requests: {
          include: { provision: true },
          where: { status: 'PROVISIONED' },
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

**위치**: 기존 DEGRADED 체크 직후, 사용량 체크 전.

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | Snowflake/Glue 데이터 프로비전 승인 시 데이터플랫폼팀에 Knox 알림 발송 |
| 2 | `/dp/requests`에서 외부 권한 미확인 건에 주황 배지 표시 |
| 3 | "외부 권한 처리 완료" 버튼 클릭 시 `externalGranted=true` + AuditLog 기록 |
| 4 | `externalGranted=false`인 Snowflake/Glue 에이전트 호출 시 Policy Gateway DEGRADED 반환 |
| 5 | `externalGranted=true` 확인 후 정상 ALLOW |
| 6 | INTERNAL 데이터는 이 체크를 거치지 않음 (기존 동작 무변경) |

---

## 참고 파일

- `snowflake-glue-integration-roadmap.md` — 옵션 비교 및 결정 근거
- `lib/gateway/policy.ts` — DEGRADED 추가 위치
- `app/api/dp/requests/[id]/route.ts` — 승인 알림 추가 위치
- `prisma/schema.prisma` — DataProvision 필드 추가
