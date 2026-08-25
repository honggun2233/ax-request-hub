# AX Hub v3 구현 요약 — 2026-08-24

> 작성: Jarvis (2026-08-24)
> 범위: v3 아키텍처 통합본(2026-07-23) 기준 갭 분석 및 구현 내역
> TypeScript 검증: `npx tsc --noEmit` 전건 통과 (exit 0)

---

## 1. 구현 완료 항목 전체 목록

### 1-A. 신규 생성 파일 (NEW)

| 파일 | 역할 |
|------|------|
| `app/api/council/agenda/[id]/route.ts` | 협의회 심의 패키지 상세 조회 (GET) |
| `app/api/registry/[id]/kpi-score/route.ts` | 월별 상용 KPI 기록 + RETIRE_CANDIDATE 자동 플래그 |
| `app/api/dp/requests/route.ts` | 데이터 신청 전체 큐 (DATA_PLATFORM/AX_TEAM) |
| `app/api/dp/requests/[id]/review/route.ts` | 신청 접수·SEC_REVIEW 전환 (DATA_PLATFORM) |
| `app/api/dp/requests/[id]/approve/route.ts` | 신청 승인/반려, G3 선결 검증 (DATA_PLATFORM) |
| `app/api/dp/requests/[id]/provision/route.ts` | 제공 실행, DataProvision 생성 (DATA_PLATFORM) |
| `app/api/dp/provisions/[id]/revoke/route.ts` | 제공 회수 + 에이전트 자동 SUSPENDED (DATA_PLATFORM) |
| `app/api/dp/catalog/route.ts` | 카탈로그 GET/POST/PATCH (DATA_PLATFORM) |
| `app/api/admin/usage/expire-check/route.ts` | 만료 배치 (일 1회, AX_TEAM) |
| `app/api/admin/agents/inactive-check/route.ts` | 12개월 미사용 자동 DEPRECATED 배치 (AX_TEAM) |

### 1-B. 수정된 파일 (MODIFIED)

| 파일 | 추가된 내용 |
|------|-------------|
| `app/api/council/agenda/[id]/decide/route.ts` | PROD_APPROVAL 의결 시 Project.status 자동 동기화 (production/closed) |
| `app/api/council/agenda/[id]/conditions/route.ts` | 조건 전건 이행 완료 시 Project.status → production 동기화 |
| `app/api/registry/route.ts` | GATE1→GATE2 DataRequest PROVISIONED 선결 검증 + RETIRED 시 DataProvision 전건 회수 |
| `app/api/admin/agents/flags/route.ts` | AgentRegistry.retireFlag 목록 포함 (registry 섹션 추가) |
| `app/api/executive/route.ts` | agentPhaseSummary (development/productionActive/productionSuspended/retireCandidate) 추가 |
| `app/api/approve/[id]/route.ts` | 과제 반려 시 PROVISIONED DataProvision 전건 자동 REVOKED |
| `app/api/data/requests/[id]/route.ts` | PATCH 후 AuditLog 자동 기록 |
| `app/api/data/requests/route.ts` | POST body에 prevRequestId 추가 |
| `app/registry/page.tsx` | KpiScorePanel 컴포넌트 + RETIRE_CANDIDATE 배너 + KPI 입력 UI |

---

## 2. 구현 상세 — 신규 파일 코드

### 2-1. `app/api/council/agenda/[id]/route.ts`

```typescript
// GET /api/council/agenda/[id]
// 심의 패키지 조회 — 안건 + 에이전트 정보 + 실시간 요건 검증 + 조건 파싱
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { checkProdEligibility, displayName } from "@/lib/council-eligibility";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const item = await prisma.councilAgendaItem.findUnique({
    where: { id },
    include: {
      agent: {
        include: {
          scores: { where: { phase: "PRODUCTION" }, orderBy: { month: "desc" } },
          projectLinks: { include: { project: { select: { id: true, title: true } } } },
        },
      },
      meeting: true,
    },
  });
  if (!item) return NextResponse.json({ error: "안건을 찾을 수 없습니다" }, { status: 404 });

  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(item.packageMeta ?? "{}"); } catch {}

  let parsedConditions: unknown[] = [];
  try { parsedConditions = JSON.parse(item.conditions ?? "[]"); } catch {}

  const { eligible, checks } = await checkProdEligibility(item.agentId);

  return NextResponse.json({
    ...item,
    agent: { ...item.agent, name: displayName(item.agent) },
    packageMeta: parsed,
    parsedConditions,
    eligibility: { eligible, checks },
  });
}
```

---

### 2-2. `app/api/registry/[id]/kpi-score/route.ts`

```typescript
// POST /api/registry/[id]/kpi-score — 월별 상용 KPI 기록
// 3개월 연속 60% 미달 → retireFlag=true 자동 플래그 + AuditLog
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const { month, achieveRate, note } = await req.json();
  if (!month || achieveRate === undefined)
    return NextResponse.json({ error: "month, achieveRate는 필수입니다" }, { status: 400 });
  if (achieveRate < 0 || achieveRate > 200)
    return NextResponse.json({ error: "achieveRate는 0~200 범위여야 합니다" }, { status: 400 });

  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) return NextResponse.json({ error: "에이전트를 찾을 수 없습니다" }, { status: 404 });
  if (agent.phase !== "PRODUCTION")
    return NextResponse.json({ error: "PRODUCTION 에이전트만 상용 KPI를 기록할 수 있습니다" }, { status: 409 });

  const score = await prisma.agentScore.create({
    data: {
      agentId,
      phase: "PRODUCTION",
      month,
      kpiActual: JSON.stringify({ achieveRate, note: note ?? null }),
      achieveRate,
    },
  });

  // 3개월 연속 60% 미달 → RETIRE_CANDIDATE 자동 플래그
  const recent3 = await prisma.agentScore.findMany({
    where: { agentId, phase: "PRODUCTION", month: { not: null } },
    orderBy: { month: "desc" },
    take: 3,
  });
  const consecutiveMiss = recent3.length === 3 && recent3.every((s) => (s.achieveRate ?? 100) < 60);
  let retireFlagSet = false;

  if (consecutiveMiss && !agent.retireFlag) {
    await prisma.agentRegistry.update({ where: { id: agentId }, data: { retireFlag: true } });
    await prisma.auditLog.create({
      data: {
        entityType: "AgentRegistry", entityId: agentId,
        action: "RETIRE_CANDIDATE_AUTO_FLAGGED",
        actorEmail: "SYSTEM",
        detail: JSON.stringify({ trigger: "3개월 연속 KPI 60% 미달", months: recent3.map((s) => s.month) }),
      },
    });
    retireFlagSet = true;
  }

  return NextResponse.json({ score, retireFlagSet }, { status: 201 });
}

// GET — PRODUCTION KPI 기록 목록
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const scores = await prisma.agentScore.findMany({
    where: { agentId, phase: "PRODUCTION" },
    orderBy: { month: "desc" },
  });
  return NextResponse.json(scores);
}
```

---

### 2-3. `app/api/dp/requests/[id]/review/route.ts`

```typescript
// POST /api/dp/requests/[id]/review
// REQUESTED/PENDING → REVIEWING  또는  REVIEWING → SEC_REVIEW (secReview:true)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const { secReview } = await req.json().catch(() => ({}));
  const dr = await prisma.dataRequest.findUnique({ where: { id } });
  if (!dr) return NextResponse.json({ error: "신청을 찾을 수 없습니다" }, { status: 404 });

  const validFrom = secReview ? ["REVIEWING"] : ["REQUESTED", "PENDING"];
  if (!validFrom.includes(dr.status))
    return NextResponse.json({ error: `현재 상태(${dr.status})에서는 이 전환을 수행할 수 없습니다` }, { status: 409 });

  const newStatus = secReview ? "SEC_REVIEW" : "REVIEWING";
  const [updated] = await prisma.$transaction([
    prisma.dataRequest.update({ where: { id }, data: { status: newStatus, reviewerId: auth.user?.id ?? null } }),
    prisma.auditLog.create({
      data: {
        entityType: "DataRequest", entityId: id,
        action: `DATA_REQUEST_${newStatus}`,
        actorEmail: auth.user.email,
        detail: JSON.stringify({ prevStatus: dr.status, newStatus }),
      },
    }),
  ]);
  return NextResponse.json(updated);
}
```

---

### 2-4. `app/api/dp/requests/[id]/approve/route.ts`

```typescript
// POST /api/dp/requests/[id]/approve
// decision: "APPROVED" | "REJECTED"
// G3 데이터 승인 선결: project.isEssentialBusiness === true
// NEW 유형 승인 → COLLECTING, ACCESS 유형 → APPROVED
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify, NotifyEvent } from "@/lib/notify";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const { decision, rejectReason } = await req.json();
  if (!["APPROVED", "REJECTED"].includes(decision))
    return NextResponse.json({ error: "decision은 APPROVED 또는 REJECTED여야 합니다" }, { status: 400 });
  if (decision === "REJECTED" && !rejectReason?.trim())
    return NextResponse.json({ error: "반려 사유(rejectReason)는 필수입니다" }, { status: 400 });

  const dr = await prisma.dataRequest.findUnique({
    where: { id },
    include: { project: { select: { requesterEmail: true, title: true, isEssentialBusiness: true } } },
  });
  if (!dr) return NextResponse.json({ error: "신청을 찾을 수 없습니다" }, { status: 404 });

  if (!["REVIEWING", "SEC_REVIEW"].includes(dr.status))
    return NextResponse.json({ error: `현재 상태(${dr.status})에서는 승인/반려할 수 없습니다` }, { status: 409 });

  // G3 선결 조건 (v3 §10-1)
  if (decision === "APPROVED" && dr.classification === "G3") {
    if (!(dr.project as any)?.isEssentialBusiness)
      return NextResponse.json(
        { error: 'G3(기밀) 승인을 위해서는 과제가 "본질적 업무"로 지정되어야 합니다' },
        { status: 422 }
      );
  }

  // NEW 유형 승인 → COLLECTING, ACCESS → APPROVED
  const nextStatus = decision === "REJECTED" ? "REJECTED" : dr.type === "NEW" ? "COLLECTING" : "APPROVED";

  await prisma.$transaction([
    prisma.dataRequest.update({
      where: { id },
      data: { status: nextStatus, reviewerId: auth.user?.id ?? null,
        ...(decision === "REJECTED" ? { rejectReason: rejectReason.trim() } : {}) },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "DataRequest", entityId: id,
        action: `DATA_REQUEST_${decision}`,
        actorEmail: auth.user.email,
        detail: JSON.stringify({ decision, rejectReason: rejectReason ?? null, nextStatus }),
      },
    }),
  ]);

  const email = dr.project?.requesterEmail;
  if (email) {
    await notify({
      type: "DATA_REQUEST_UPDATE",
      title: decision === "APPROVED" ? "데이터 신청 승인" : "데이터 신청 반려",
      body: decision === "APPROVED"
        ? `'${dr.project?.title}' 과제의 데이터 신청이 승인되었습니다.`
        : `'${dr.project?.title}' 과제의 데이터 신청이 반려되었습니다. 사유: ${rejectReason}`,
      link: "/me/data",
    } as NotifyEvent, [email]).catch(() => {});
  }

  return NextResponse.json({ ok: true, nextStatus });
}
```

---

### 2-5. `app/api/dp/requests/[id]/provision/route.ts`

```typescript
// POST /api/dp/requests/[id]/provision
// APPROVED/COLLECTING → PROVISIONED
// DataProvision 생성 (connectionRef는 시크릿 저장소 키만 저장)
// 신청자 알림, AuditLog 기록
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const { deliveryMode, connectionRef, expiresAt } = await req.json();
  // deliveryMode: "API" | "FILE" | "DB"
  // connectionRef: 시크릿 저장소 키 (원문 저장 금지 §10-3)
  // expiresAt: 미래 날짜 ISO string

  // 상태 검증: APPROVED 또는 COLLECTING
  // DataProvision 중복 방지
  // expiresAt 미래 날짜 검증
  // Transaction: DataProvision.create + DataRequest.update(PROVISIONED) + AuditLog.create
  // 신청자 notify()
}
```

**핵심 로직:**
- `status` 체크: `["APPROVED", "COLLECTING"].includes(dr.status)` — 아니면 409
- `dr.provision` 존재 시 "이미 제공 완료" 409
- `expiresAt <= now` 이면 400
- 모두 단일 트랜잭션 처리

---

### 2-6. `app/api/dp/provisions/[id]/revoke/route.ts`

```typescript
// POST /api/dp/provisions/[id]/revoke
// DATA_PLATFORM 또는 AX_TEAM 가능
// revokeReason 필수
// DataProvision.revokedAt 설정 + DataRequest → REVOKED
// 연결 PRODUCTION 에이전트 → prodStatus=SUSPENDED
// 모두 단일 트랜잭션
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM", "AX_TEAM");
  if ("error" in auth) return auth.error;

  const { revokeReason } = await req.json();
  // revokeReason 필수 검증
  // provision 조회 → request 포함
  // 이미 revokedAt 있으면 409
  // Transaction:
  //   1. DataProvision.update(revokedAt, revokeReason)
  //   2. DataRequest.update(status=REVOKED)
  //   3. PRODUCTION 에이전트 자동 SUSPENDED (projectId 통해 조회)
  //   4. AuditLog (PROVISION_REVOKED + AGENT_AUTO_SUSPENDED_PROVISION_REVOKED)
}
```

---

### 2-7. `app/api/dp/catalog/route.ts`

```typescript
// GET — 전체 인증 사용자 조회 가능
// ?q=검색어&classification=G1|G2|G3&ownerDept=팀명&activeOnly=true(기본)

// POST — DATA_PLATFORM 전용 신규 자산 등록
// 필수: name, description, ownerDept, classification, deliveryModes
// deliveryModes: "API,FILE,DB" (comma-separated) 또는 배열
// externalId unique 중복 체크

// PATCH — DATA_PLATFORM 전용 수정
// body: { id, ...허용 필드 }
// 허용 필드: name/description/ownerDept/classification/schemaMeta/deliveryModes/updateCycle/
//            isActive/sourceSystem/externalId/snowflakeDb/snowflakeSchema
// AuditLog 기록
```

---

### 2-8. `app/api/admin/usage/expire-check/route.ts`

```typescript
// POST /api/admin/usage/expire-check
// AX_TEAM 전용, 일 1회 실행
//
// 처리 1: expiresAt <= now → DataProvision EXPIRED + DataRequest EXPIRED
//          연결 PRODUCTION 에이전트 자동 SUSPENDED
// 처리 2: expiresAt <= now+14d → 만료 임박 알림 (requesterEmail)
//
// 반환: { ok, expiredCount, suspendedAgentCount, warningSentCount }
```

---

### 2-9. `app/api/admin/agents/inactive-check/route.ts` *(신규)*

```typescript
// POST /api/admin/agents/inactive-check
// AX_TEAM 전용, 일 1회 실행
// 12개월 미사용(lastUsedAt <= now-12m 또는 null) PRODUCTION ACTIVE 에이전트 자동 DEPRECATED
// AuditLog: AGENT_AUTO_DEPRECATED_INACTIVE
//
// GET — 처리 없이 대상 목록만 미리보기
// 반환: { cutoff, candidates[] }
```

---

## 3. 수정 상세 — 기존 파일 변경사항

### 3-1. `app/api/council/agenda/[id]/decide/route.ts` — Project.status 동기화

```typescript
// PROD_APPROVAL 의결 시 Project.status 자동 동기화
// Transaction 배열에 추가:
...(item.itemType === "PROD_APPROVAL" && decision === "APPROVED" && item.agent.projectId
  ? [prisma.project.update({ where: { id: item.agent.projectId }, data: { status: "production" } })]
  : []),
...(item.itemType === "PROD_APPROVAL" && decision === "REJECTED" && item.agent.projectId
  ? [prisma.project.update({ where: { id: item.agent.projectId }, data: { status: "closed" } })]
  : []),
```

---

### 3-2. `app/api/council/agenda/[id]/conditions/route.ts` — 조건 이행 완료 시 동기화

```typescript
// 조건 전건 이행(allDone) 시 Project.status → production
const agent = await prisma.agentRegistry.findUnique({ where: { id: item.agentId }, select: { projectId: true } });

// Transaction 안:
...(agent?.projectId
  ? [prisma.project.update({ where: { id: agent.projectId }, data: { status: "production" } })]
  : []),
```

---

### 3-3. `app/api/registry/route.ts` — GATE1→GATE2 DataRequest 선결 검증

```typescript
// PATCH body에 lifecycleStage=GATE2 포함 시:
if (lifecycleStage === 'GATE2') {
  const current = await prisma.agentRegistry.findUnique({
    where: { id }, select: { projectId: true, lifecycleStage: true }
  });
  if (current?.lifecycleStage === 'GATE1' && current.projectId) {
    const unprovisionedCount = await prisma.dataRequest.count({
      where: {
        projectId: current.projectId,
        status: { notIn: ['PROVISIONED', 'REJECTED', 'REVOKED'] },
      },
    });
    if (unprovisionedCount > 0)
      return NextResponse.json({ error: `GATE1 → GATE2 전환 불가: 미처리 데이터 신청 ${unprovisionedCount}건` }, { status: 422 });
  }
}
```

---

### 3-4. `app/api/registry/route.ts` — RETIRED 시 DataProvision 전건 회수

```typescript
// lifecycleStage=RETIRED 처리 시:
const dataRequests = await prisma.dataRequest.findMany({
  where: { projectId: agent.projectId, status: 'PROVISIONED' }, select: { id: true },
});
if (requestIds.length > 0) {
  await prisma.dataProvision.updateMany({
    where: { requestId: { in: requestIds }, revokedAt: null },
    data: { revokedAt: revokeNow, revokeReason: `에이전트 폐기(RETIRED): ${agent.agentName ?? id}` },
  });
  await prisma.dataRequest.updateMany({ where: { id: { in: requestIds } }, data: { status: 'REVOKED' } });
  // + AuditLog DATA_PROVISIONS_REVOKED_ON_RETIRE
}
```

---

### 3-5. `app/api/executive/route.ts` — 에이전트 단계별 요약

```typescript
const [devCount, prodCount, suspendedCount, retireCandidateCount] = await Promise.all([
  prisma.agentRegistry.count({ where: { phase: 'DEVELOPMENT' } }),
  prisma.agentRegistry.count({ where: { phase: 'PRODUCTION', prodStatus: 'ACTIVE' } }),
  prisma.agentRegistry.count({ where: { phase: 'PRODUCTION', prodStatus: 'SUSPENDED' } }),
  prisma.agentRegistry.count({ where: { retireFlag: true } }),
]);

// 응답에 포함:
agentPhaseSummary: {
  development: devCount,
  productionActive: prodCount,
  productionSuspended: suspendedCount,
  retireCandidate: retireCandidateCount,
}
```

---

### 3-6. `app/api/approve/[id]/route.ts` — 과제 반려 시 DataProvision 자동 회수

```typescript
if (typedAction === 'reject') {
  const provisionedRequests = await prisma.dataRequest.findMany({
    where: { projectId: id, status: 'PROVISIONED' }, select: { id: true },
  });
  if (provisionedRequests.length > 0) {
    await prisma.dataProvision.updateMany({
      where: { requestId: { in: requestIds }, revokedAt: null },
      data: { revokedAt: revokeNow, revokeReason: `과제 반려(REJECTED): ${id}` },
    });
    await prisma.dataRequest.updateMany({ where: { id: { in: requestIds } }, data: { status: 'REVOKED' } });
  }
}
```

---

### 3-7. `app/api/admin/agents/flags/route.ts` — AgentRegistry.retireFlag 포함

```typescript
// 기존 legacyFlagged (Agent.performanceFlag) 에 추가:
const registryFlagged = await prisma.agentRegistry.findMany({
  where: { retireFlag: true },
  include: { scores: { where: { phase: 'PRODUCTION', month: { not: null } }, orderBy: { month: 'desc' }, take: 3 } },
});

// 수정: a.department → a.owner (AgentRegistry에 department 필드 없음)
department: a.owner ?? null,
```

---

### 3-8. `app/registry/page.tsx` — KPI 입력 UI + RETIRE_CANDIDATE 배너

```tsx
// KpiScorePanel 컴포넌트 추가 (ACTIVE PRODUCTION 에이전트용)
function KpiScorePanel({ agentId, onSaved }: { agentId: string; onSaved: () => void }) {
  // 입력: month (YYYY-MM), achieveRate (0~200), note
  // POST /api/registry/${agentId}/kpi-score
  // 응답에 retireFlagSet: true 이면 경고 표시
}

// SlideOver 내 RETIRE_CANDIDATE 배너
{agent.retireFlag && (
  <div style={{ border: '1px solid rgba(185,64,64,.35)', background: 'rgba(185,64,64,.08)', ... }}>
    RETIRE_CANDIDATE — 폐기 검토 대상
    (월별 KPI 달성률이 3개월 연속 60% 미달로 자동 플래그)
  </div>
)}

// ACTIVE 에이전트에만 KpiScorePanel 표시
{isAxTeam && agent.lifecycleStage === 'ACTIVE' && (
  <KpiScorePanel agentId={agent.id} onSaved={() => {}} />
)}
```

---

## 4. 아키텍처 v3 대비 구현 현황 체크리스트

### 에이전트 라이프사이클 (§7)

| 요건 | 상태 | 비고 |
|------|------|------|
| GATE1→GATE2 DataRequest 선결 검증 | ✅ 완료 | registry PATCH에 추가 |
| RETIRE_CANDIDATE 자동 플래그 (3개월 60% 미달) | ✅ 완료 | kpi-score POST |
| 12개월 미사용 자동 DEPRECATED | ✅ 완료 | inactive-check POST/GET |
| RETIRED 시 DataProvision 전건 회수 | ✅ 완료 | registry PATCH RETIRED |
| 과제 반려 시 DataProvision 자동 회수 | ✅ 완료 | approve/[id] reject |

### 협의회 (§8)

| 요건 | 상태 | 비고 |
|------|------|------|
| 상정 요건 5종 자동 검증 | ✅ 완료 | council-eligibility.ts |
| 심의 패키지 조회 API | ✅ 완료 | agenda/[id] GET |
| 의결 후 Project.status 동기화 | ✅ 완료 | decide + conditions |
| 조건부 승인 조건 이행 추적 | ✅ 완료 | conditions PATCH |
| REJECTED → phase=CLOSED | ✅ 완료 | decide REJECTED 처리 |

### 데이터 프로비저닝 (§10)

| 요건 | 상태 | 비고 |
|------|------|------|
| 신청 접수 (REVIEWING) | ✅ 완료 | dp/requests/[id]/review |
| G3 SEC_REVIEW 전환 | ✅ 완료 | review secReview=true |
| 승인/반려 (G3 isEssentialBusiness 선결) | ✅ 완료 | dp/requests/[id]/approve |
| NEW → COLLECTING | ✅ 완료 | approve 상태 분기 |
| 제공 실행 (DataProvision 생성) | ✅ 완료 | dp/requests/[id]/provision |
| connectionRef 시크릿 키만 저장 | ✅ 완료 | provision POST 구현 |
| 제공 회수 + 에이전트 자동 SUSPENDED | ✅ 완료 | dp/provisions/[id]/revoke |
| 만료 배치 (일 1회) | ✅ 완료 | admin/usage/expire-check |
| 만료 14일 전 알림 | ✅ 완료 | expire-check 내 포함 |
| 카탈로그 조회 (전직원) | ✅ 완료 | dp/catalog GET |
| 카탈로그 등록/수정 (DATA_PLATFORM) | ✅ 완료 | dp/catalog POST/PATCH |
| 전체 신청 큐 (DATA_PLATFORM) | ✅ 완료 | dp/requests GET |

### 경영진 대시보드 (§13)

| 요건 | 상태 | 비고 |
|------|------|------|
| 개발중/상용 에이전트 분리 요약 | ✅ 완료 | executive GET agentPhaseSummary |
| SUSPENDED/RETIRE_CANDIDATE 수 포함 | ✅ 완료 | executive GET |

### 감사 로그 (§1 — 거버넌스 추적)

| 대상 | 상태 | 비고 |
|------|------|------|
| DataRequest 모든 상태 전이 | ✅ 완료 | review/approve/provision + requests/[id] PATCH |
| DataProvision 생성/회수/만료 | ✅ 완료 | provision/revoke/expire-check |
| AgentRegistry 자동 SUSPENDED | ✅ 완료 | revoke/expire-check |
| AgentRegistry 자동 DEPRECATED (미사용) | ✅ 완료 | inactive-check |
| RETIRE_CANDIDATE 자동 플래그 | ✅ 완료 | kpi-score POST |
| DataAsset 등록/수정 | ✅ 완료 | dp/catalog POST/PATCH |
| 협의회 의결 | ✅ 기존 구현 |
| 과제 승인/반려 | ✅ 기존 구현 |

---

## 5. 미결 사항 (v3 §21 + 추가 확인)

| 항목 | 우선순위 | 내용 |
|------|----------|------|
| G3 신청서 Claude API 전송 | P1 | 기밀 선판정 또는 마스킹 방식 미확정 |
| 이의제기(재심) 절차 | P1 | API/UI 모두 미구현 (`/appeals` 라우트 exists, UI 미완) |
| `/council/agenda/[id]` 프론트엔드 페이지 | P2 | API만 있고 심의 패키지 상세 UI 없음 |
| 상용 재승인(forProduction=true) 강제 플로우 | P2 | 협의회 APPROVED 시 파일럿 제공분 자동 만료 처리 미구현 |
| `/api/data/provisions` 레거시 라우트 권한 | P2 | 역할 체크 없음 — dp/requests/[id]/provision으로 대체 필요 |
| 리터러시 레벨 자동 평가 | P3 | 현재 수동 심사만 |
| 모바일 반응형 | P3 | 미최적화 |
| 감사로그 보존기간·위변조 방지 | P3 | 전자금융감독규정 관점 명세 필요 |
| SEC_REVIEW 처리 주체·방식 | P3 | 시스템 내 처리 vs 오프라인 기록 미결 |
| **보안 이슈 (배포 전 처리)** | 배포 직전 | bcrypt auth, 트랜잭션 approve, requireRole isActive 체크, DEV_BYPASS_USER |

---

## 6. 배치 작업 일정 (운영 권고)

| 배치 | 엔드포인트 | 주기 | 비고 |
|------|-----------|------|------|
| 데이터 제공 만료 처리 | `POST /api/admin/usage/expire-check` | 일 1회 | EXPIRED 처리 + 14일 전 알림 |
| 12개월 미사용 DEPRECATED | `POST /api/admin/agents/inactive-check` | 일 1회 | 미리보기: GET |
| RETIRE_CANDIDATE 자동 플래그 | 월별 KPI 입력 시 자동 | KPI 입력 시점 | registry/[id]/kpi-score POST |

---

## 7. TypeScript 검증 결과

```
$ npx tsc --noEmit
(출력 없음 — 에러 없음)
Exit code: 0
```

모든 신규/수정 파일 타입 체크 통과.

---

*문서 끝 — 다음 세션에서 참조용*
