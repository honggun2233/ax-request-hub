# AX Hub v3 구현 전체 코드 문서 — 2026-08-24

> 작성: Jarvis (2026-08-24)  
> 범위: v3 아키텍처 통합본(2026-07-23) 기준 갭 분석 및 구현 전체 코드  
> TypeScript 검증: `npx tsc --noEmit` 전건 통과 (exit 0)  
> 서머리 버전: `docs/tasks/v23-implementation-summary-20260824.md`

---

## 목차

1. [신규 생성 파일 (10개)](#1-신규-생성-파일)
2. [수정된 파일 (9개)](#2-수정된-파일)
3. [아키텍처 대비 구현 현황](#3-아키텍처-대비-구현-현황)
4. [미결 사항](#4-미결-사항)
5. [배치 운영 가이드](#5-배치-운영-가이드)

---

## 1. 신규 생성 파일

---

### 1-1. `app/api/council/agenda/[id]/route.ts`

협의회 심의 패키지 상세 조회 API.  
안건 정보 + 에이전트 스냅샷 + 실시간 요건 검증 + 조건 파싱 반환.

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { checkProdEligibility, displayName } from "@/lib/council-eligibility";

/**
 * GET /api/council/agenda/[id]
 * 협의회 심의 패키지 조회 (안건 상세 + 에이전트 스냅샷 + 요건 점검 결과).
 * v3 §8: 안건 조회 시 스냅샷 packageMeta 포함 반환.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const item = await prisma.councilAgendaItem.findUnique({
    where: { id },
    include: {
      meeting: true,
      agent: {
        include: {
          scores: {
            where: { phase: "DEVELOPMENT", month: { not: null } },
            orderBy: { month: "asc" },
          },
          projects: { include: { project: true } },
        },
      },
    },
  });

  if (!item) return NextResponse.json({ error: "안건을 찾을 수 없습니다" }, { status: 404 });

  // 최신 요건 상태 실시간 재계산 (패키지 생성 이후 변경분 반영)
  const { eligible, checks } = await checkProdEligibility(item.agentId);

  // 조건부 승인 조건 JSON 파싱
  let parsedConditions: { condition: string; done: boolean; checkedBy: string | null }[] | null = null;
  if (item.conditions) {
    try { parsedConditions = JSON.parse(item.conditions); } catch { /* ignore */ }
  }

  return NextResponse.json({
    ...item,
    agent: { ...item.agent, name: displayName(item.agent) },
    packageMeta: item.packageMeta ? (() => { try { return JSON.parse(item.packageMeta!); } catch { return null; } })() : null,
    parsedConditions,
    eligibility: { eligible, checks },
  });
}
```

---

### 1-2. `app/api/registry/[id]/kpi-score/route.ts`

월별 상용 KPI 기록 + 3개월 연속 60% 미달 → RETIRE_CANDIDATE 자동 플래그.

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * POST /api/registry/[id]/kpi-score
 * 월별 KPI 실적 입력 (AgentScore, phase=PRODUCTION).
 * 3개월 연속 60% 미달 시 AgentRegistry.retireFlag=true (RETIRE_CANDIDATE 자동 플래그).
 * v3 §9-1: 상용 KPI 기반 관리.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { month, kpiActual, achieveRate, note } = body;

  if (!month || achieveRate == null) {
    return NextResponse.json(
      { error: "month, achieveRate는 필수입니다 (형식: '2026-07')" },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month는 'YYYY-MM' 형식입니다" },
      { status: 400 }
    );
  }

  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) return NextResponse.json({ error: "에이전트를 찾을 수 없습니다" }, { status: 404 });
  if (agent.phase !== "PRODUCTION") {
    return NextResponse.json(
      { error: "상용(PRODUCTION) 단계 에이전트만 월별 KPI 실적을 기록할 수 있습니다" },
      { status: 400 }
    );
  }

  // upsert — 같은 달 재입력 허용
  const score = await prisma.agentScore.upsert({
    where: { agentId_phase_month: { agentId, phase: "PRODUCTION", month } },
    update: { kpiActual: kpiActual ? JSON.stringify(kpiActual) : null, achieveRate, score: achieveRate, rationale: note ?? null },
    create: {
      agentId,
      phase: "PRODUCTION",
      month,
      kpiActual: kpiActual ? JSON.stringify(kpiActual) : null,
      achieveRate,
      score: achieveRate,
      rationale: note ?? null,
    },
  });

  // 최근 3개월 연속 60% 미달 → retireFlag=true (RETIRE_CANDIDATE 자동 플래그)
  const recent3 = await prisma.agentScore.findMany({
    where: { agentId, phase: "PRODUCTION", month: { not: null } },
    orderBy: { month: "desc" },
    take: 3,
  });
  const consecutiveMiss = recent3.length === 3 && recent3.every((s) => (s.achieveRate ?? 100) < 60);

  if (consecutiveMiss && !agent.retireFlag) {
    await prisma.agentRegistry.update({
      where: { id: agentId },
      data: { retireFlag: true },
    });
    await prisma.auditLog.create({
      data: {
        entityType: "AgentRegistry",
        entityId: agentId,
        action: "RETIRE_CANDIDATE_AUTO_FLAGGED",
        actorEmail: auth.user.email,
        detail: JSON.stringify({ reason: "KPI 60% 미달 3개월 연속", months: recent3.map((s) => s.month) }),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      entityType: "AgentRegistry",
      entityId: agentId,
      action: "KPI_SCORE_RECORDED",
      actorEmail: auth.user.email,
      detail: JSON.stringify({ month, achieveRate, consecutiveMiss }),
    },
  });

  return NextResponse.json({ score, retireFlagSet: consecutiveMiss && !agent.retireFlag }, { status: 201 });
}

/**
 * GET /api/registry/[id]/kpi-score
 * 해당 에이전트의 월별 KPI 실적 목록.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;
  const auth = await requireRole();
  if ("error" in auth) return auth.error;

  const scores = await prisma.agentScore.findMany({
    where: { agentId, phase: "PRODUCTION", month: { not: null } },
    orderBy: { month: "desc" },
  });
  return NextResponse.json(scores);
}
```

---

### 1-3. `app/api/dp/requests/route.ts`

DATA_PLATFORM 전용 데이터 신청 처리 큐. `?status=` 필터 지원.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * GET /api/dp/requests
 * DATA_PLATFORM 전용 데이터 신청 처리 큐.
 * AX_TEAM은 읽기 전용(RO)으로 접근 가능.
 * v3 §7: 데이터 프로비저닝 워크플로우.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole("DATA_PLATFORM", "AX_TEAM");
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const where = status ? { status } : {};

  const requests = await prisma.dataRequest.findMany({
    where,
    include: {
      asset: { select: { id: true, name: true, classification: true } },
      project: { select: { id: true, title: true, department: true } },
      provision: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}
```

---

### 1-4. `app/api/dp/requests/[id]/review/route.ts`

REQUESTED → REVIEWING 접수. `secReview:true` 로 REVIEWING → SEC_REVIEW 전환.

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * POST /api/dp/requests/[id]/review
 * 검토 시작 (REQUESTED → REVIEWING) 또는 G3 SEC_REVIEW 전환.
 * v3 §10-2: DataRequest 상태 전이.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const { secReview } = await req.json().catch(() => ({}));

  const dr = await prisma.dataRequest.findUnique({ where: { id } });
  if (!dr) return NextResponse.json({ error: "신청을 찾을 수 없습니다" }, { status: 404 });

  const validFrom = secReview ? ["REVIEWING"] : ["REQUESTED", "PENDING"];
  if (!validFrom.includes(dr.status)) {
    return NextResponse.json(
      { error: `현재 상태(${dr.status})에서는 이 전환을 수행할 수 없습니다` },
      { status: 409 }
    );
  }

  const newStatus = secReview ? "SEC_REVIEW" : "REVIEWING";
  const updated = await prisma.$transaction([
    prisma.dataRequest.update({
      where: { id },
      data: { status: newStatus, reviewerId: (auth as any).user?.id ?? null },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "DataRequest",
        entityId: id,
        action: `DATA_REQUEST_${newStatus}`,
        actorEmail: (auth as any).user.email,
        detail: JSON.stringify({ prevStatus: dr.status, newStatus }),
      },
    }),
  ]);

  return NextResponse.json(updated[0]);
}
```

---

### 1-5. `app/api/dp/requests/[id]/approve/route.ts`

승인/반려. G3 데이터는 `isEssentialBusiness` 선결. NEW 유형 승인 → COLLECTING, ACCESS → APPROVED.

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify, NotifyEvent } from "@/lib/notify";

/**
 * POST /api/dp/requests/[id]/approve
 * 데이터 신청 승인/반려.
 * - APPROVED: ACCESS 유형은 즉시 PROVISIONED 가능. NEW 유형은 COLLECTING 단계 진입.
 * - REJECTED: rejectReason 필수.
 * - G3 등급은 isEssentialBusiness 선결 확인 (v3 §10-1).
 * v3 §10-2: DataRequest 상태 전이.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { decision, rejectReason } = body; // decision: "APPROVED" | "REJECTED"

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    return NextResponse.json({ error: "decision은 APPROVED 또는 REJECTED여야 합니다" }, { status: 400 });
  }
  if (decision === "REJECTED" && !rejectReason?.trim()) {
    return NextResponse.json({ error: "반려 사유(rejectReason)는 필수입니다" }, { status: 400 });
  }

  const dr = await prisma.dataRequest.findUnique({
    where: { id },
    include: { project: { select: { requesterEmail: true, title: true, isEssentialBusiness: true } } },
  });
  if (!dr) return NextResponse.json({ error: "신청을 찾을 수 없습니다" }, { status: 404 });

  if (!["REVIEWING", "SEC_REVIEW"].includes(dr.status)) {
    return NextResponse.json(
      { error: `현재 상태(${dr.status})에서는 승인/반려할 수 없습니다` },
      { status: 409 }
    );
  }

  // G3 데이터 승인 선결조건 (v3 §10-1)
  if (decision === "APPROVED" && dr.classification === "G3") {
    if (!(dr.project as any)?.isEssentialBusiness) {
      return NextResponse.json(
        { error: 'G3(기밀) 데이터 승인을 위해서는 과제가 "본질적 업무"로 지정되어야 합니다' },
        { status: 422 }
      );
    }
  }

  // NEW 유형 승인 → COLLECTING, ACCESS 유형 → APPROVED (제공 실행으로 PROVISIONED)
  const nextStatus = decision === "REJECTED"
    ? "REJECTED"
    : dr.type === "NEW" ? "COLLECTING" : "APPROVED";

  await prisma.$transaction([
    prisma.dataRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewerId: (auth as any).user?.id ?? null,
        ...(decision === "REJECTED" ? { rejectReason: rejectReason.trim() } : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "DataRequest",
        entityId: id,
        action: `DATA_REQUEST_${decision}`,
        actorEmail: (auth as any).user.email,
        detail: JSON.stringify({ decision, rejectReason: rejectReason ?? null, nextStatus }),
      },
    }),
  ]);

  // 신청자 알림
  const email = dr.project?.requesterEmail;
  if (email) {
    const event: NotifyEvent = {
      type: "DATA_REQUEST_UPDATE",
      title: decision === "APPROVED" ? "데이터 신청 승인" : "데이터 신청 반려",
      body: decision === "APPROVED"
        ? `'${dr.project?.title ?? ""}' 과제의 데이터 신청이 승인되었습니다.`
        : `'${dr.project?.title ?? ""}' 과제의 데이터 신청이 반려되었습니다. 사유: ${rejectReason}`,
      link: "/me/data",
    };
    await notify(event, [email]).catch(() => {});
  }

  return NextResponse.json({ ok: true, nextStatus });
}
```

---

### 1-6. `app/api/dp/requests/[id]/provision/route.ts`

APPROVED/COLLECTING → PROVISIONED. DataProvision 생성 (connectionRef는 시크릿 키만).

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify, NotifyEvent } from "@/lib/notify";

/**
 * POST /api/dp/requests/[id]/provision
 * 데이터 제공 실행 — DataProvision 생성 + DataRequest status → PROVISIONED.
 * connectionRef는 시크릿 저장소 키만 저장 (원문 저장 금지, v3 §10-3).
 * v3 §10-2: APPROVED/COLLECTING → PROVISIONED.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { deliveryMode, connectionRef, expiresAt } = body;

  if (!deliveryMode || !connectionRef?.trim() || !expiresAt) {
    return NextResponse.json(
      { error: "deliveryMode, connectionRef(시크릿 키), expiresAt은 필수입니다" },
      { status: 400 }
    );
  }

  const VALID_MODES = ["API", "FILE", "DB"];
  if (!VALID_MODES.includes(deliveryMode)) {
    return NextResponse.json(
      { error: `deliveryMode는 ${VALID_MODES.join(" | ")} 중 하나여야 합니다` },
      { status: 400 }
    );
  }

  const dr = await prisma.dataRequest.findUnique({
    where: { id },
    include: { project: { select: { requesterEmail: true, title: true } }, provision: true },
  });
  if (!dr) return NextResponse.json({ error: "신청을 찾을 수 없습니다" }, { status: 404 });

  if (!["APPROVED", "COLLECTING"].includes(dr.status)) {
    return NextResponse.json(
      { error: `현재 상태(${dr.status})에서는 제공 실행을 할 수 없습니다. APPROVED 또는 COLLECTING 상태여야 합니다` },
      { status: 409 }
    );
  }
  if (dr.provision) {
    return NextResponse.json({ error: "이미 제공이 완료된 신청입니다" }, { status: 409 });
  }

  const expDate = new Date(expiresAt);
  if (isNaN(expDate.getTime()) || expDate <= new Date()) {
    return NextResponse.json({ error: "expiresAt은 미래 날짜여야 합니다" }, { status: 400 });
  }

  const [provision] = await prisma.$transaction([
    prisma.dataProvision.create({
      data: {
        requestId: id,
        deliveryMode,
        connectionRef: connectionRef.trim(),
        expiresAt: expDate,
      },
    }),
    prisma.dataRequest.update({
      where: { id },
      data: { status: "PROVISIONED", reviewerId: (auth as any).user?.id ?? null },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "DataRequest",
        entityId: id,
        action: "DATA_REQUEST_PROVISIONED",
        actorEmail: (auth as any).user.email,
        detail: JSON.stringify({ deliveryMode, expiresAt }),
      },
    }),
  ]);

  // 신청자 알림
  const email = dr.project?.requesterEmail;
  if (email) {
    const event: NotifyEvent = {
      type: "DATA_REQUEST_UPDATE",
      title: "데이터 제공 완료",
      body: `'${dr.project?.title ?? ""}' 과제의 데이터가 제공되었습니다. 이용 기한: ${expDate.toLocaleDateString("ko-KR")}`,
      link: "/me/data",
    };
    await notify(event, [email]).catch(() => {});
  }

  return NextResponse.json(provision, { status: 201 });
}
```

---

### 1-7. `app/api/dp/provisions/[id]/revoke/route.ts`

제공 회수 + 연결 PRODUCTION 에이전트 자동 SUSPENDED.

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * POST /api/dp/provisions/[id]/revoke
 * 데이터 제공 회수 — DataProvision.revokedAt 기록 + DataRequest status → REVOKED.
 * v3 §7: 데이터 프로비저닝 회수.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM", "AX_TEAM");
  if ("error" in auth) return auth.error;

  const { revokeReason } = await req.json();
  if (!revokeReason?.trim()) {
    return NextResponse.json({ error: "revokeReason(회수 사유)은 필수입니다" }, { status: 400 });
  }

  const provision = await prisma.dataProvision.findUnique({
    where: { id },
    include: { request: { select: { id: true, projectId: true } } },
  });
  if (!provision) return NextResponse.json({ error: "제공 기록을 찾을 수 없습니다" }, { status: 404 });
  if (provision.revokedAt) {
    return NextResponse.json({ error: "이미 회수된 제공 기록입니다" }, { status: 409 });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.dataProvision.update({
      where: { id },
      data: { revokedAt: now, revokeReason: revokeReason.trim() },
    }),
    prisma.dataRequest.update({
      where: { id: provision.requestId },
      data: { status: "REVOKED" },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "DataProvision",
        entityId: id,
        action: "DATA_PROVISION_REVOKED",
        actorEmail: auth.user.email,
        detail: JSON.stringify({ requestId: provision.requestId, revokeReason }),
      },
    }),
  ]);

  // 상용 운영 중 DataProvision 회수 → 연결 PRODUCTION 에이전트 자동 SUSPENDED (v3 §10-4)
  if (provision.request.projectId) {
    const prodAgent = await prisma.agentRegistry.findFirst({
      where: { projectId: provision.request.projectId, phase: "PRODUCTION", prodStatus: "ACTIVE" },
      select: { id: true, agentName: true },
    });
    if (prodAgent) {
      await prisma.agentRegistry.update({
        where: { id: prodAgent.id },
        data: { prodStatus: "SUSPENDED" },
      });
      await prisma.auditLog.create({
        data: {
          entityType: "AgentRegistry",
          entityId: prodAgent.id,
          action: "AGENT_AUTO_SUSPENDED_DATA_REVOKED",
          actorEmail: auth.user.email,
          detail: JSON.stringify({ provisionId: id, revokeReason }),
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
```

---

### 1-8. `app/api/dp/catalog/route.ts`

데이터 자산 카탈로그 GET(전 직원)/POST/PATCH(DATA_PLATFORM 전용).

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * GET  /api/dp/catalog  — 전체 인증 사용자 조회
 *   ?q=검색어&classification=G1|G2|G3&ownerDept=팀명&activeOnly=true(기본)
 * POST /api/dp/catalog  — 새 자산 등록 (DATA_PLATFORM)
 *   필수: name, description, ownerDept, classification, deliveryModes
 *   deliveryModes: "API,FILE,DB" 또는 배열
 * PATCH /api/dp/catalog — 자산 수정 (DATA_PLATFORM)
 *   body: { id, ...허용필드 }
 */

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const classification = searchParams.get("classification");
  const ownerDept = searchParams.get("ownerDept")?.trim();
  const activeOnly = searchParams.get("activeOnly") !== "false";

  const assets = await prisma.dataAsset.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(classification ? { classification } : {}),
      ...(ownerDept ? { ownerDept: { contains: ownerDept } } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }, { ownerDept: { contains: q } }] } : {}),
    },
    select: {
      id: true, name: true, description: true, ownerDept: true,
      classification: true, deliveryModes: true, updateCycle: true,
      isActive: true, schemaMeta: true, sourceSystem: true,
      externalId: true, syncedAt: true, createdAt: true, updatedAt: true,
      _count: { select: { requests: true } },
    },
    orderBy: [{ classification: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(assets);
}

export async function POST(req: Request) {
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { name, description, ownerDept, classification, schemaMeta, deliveryModes,
          updateCycle, sourceSystem, externalId, snowflakeDb, snowflakeSchema } = body;

  if (!name?.trim() || !description?.trim() || !ownerDept?.trim() || !classification || !deliveryModes)
    return NextResponse.json({ error: "name, description, ownerDept, classification, deliveryModes는 필수입니다" }, { status: 400 });

  if (!["G1", "G2", "G3"].includes(classification))
    return NextResponse.json({ error: "classification은 G1 | G2 | G3 중 하나여야 합니다" }, { status: 400 });

  const modesStr = Array.isArray(deliveryModes) ? deliveryModes.join(",") : deliveryModes;
  const invalid = modesStr.split(",").map((m: string) => m.trim()).filter((m: string) => !["API", "FILE", "DB"].includes(m));
  if (invalid.length > 0)
    return NextResponse.json({ error: `지원하지 않는 deliveryMode: ${invalid.join(", ")}` }, { status: 400 });

  if (externalId?.trim()) {
    const dup = await prisma.dataAsset.findUnique({ where: { externalId: externalId.trim() } });
    if (dup) return NextResponse.json({ error: `externalId '${externalId}'가 이미 존재합니다` }, { status: 409 });
  }

  const asset = await prisma.dataAsset.create({
    data: {
      name: name.trim(), description: description.trim(), ownerDept: ownerDept.trim(),
      classification, deliveryModes: modesStr,
      ...(schemaMeta ? { schemaMeta } : {}),
      ...(updateCycle ? { updateCycle } : {}),
      ...(sourceSystem ? { sourceSystem } : {}),
      ...(externalId?.trim() ? { externalId: externalId.trim() } : {}),
      ...(snowflakeDb ? { snowflakeDb } : {}),
      ...(snowflakeSchema ? { snowflakeSchema } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "DataAsset", entityId: asset.id,
      action: "DATA_ASSET_CREATED",
      actorEmail: (auth as any).user.email,
      detail: JSON.stringify({ name: asset.name, classification }),
    },
  });

  return NextResponse.json(asset, { status: 201 });
}

export async function PATCH(req: Request) {
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { id, ...fields } = body;

  if (!id?.trim()) return NextResponse.json({ error: "수정할 데이터 자산 id가 필요합니다" }, { status: 400 });

  const existing = await prisma.dataAsset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "데이터 자산을 찾을 수 없습니다" }, { status: 404 });

  const ALLOWED = ["name","description","ownerDept","classification","schemaMeta","deliveryModes",
                   "updateCycle","isActive","sourceSystem","externalId","snowflakeDb","snowflakeSchema"];
  const updateData: Record<string, unknown> = {};
  for (const key of ALLOWED) { if (key in fields) updateData[key] = fields[key]; }

  if (Object.keys(updateData).length === 0)
    return NextResponse.json({ error: "수정할 필드가 없습니다" }, { status: 400 });

  if (updateData.classification && !["G1","G2","G3"].includes(updateData.classification as string))
    return NextResponse.json({ error: "classification은 G1 | G2 | G3 중 하나여야 합니다" }, { status: 400 });

  if (updateData.externalId && updateData.externalId !== existing.externalId) {
    const dup = await prisma.dataAsset.findUnique({ where: { externalId: updateData.externalId as string } });
    if (dup) return NextResponse.json({ error: `externalId '${updateData.externalId}'가 이미 존재합니다` }, { status: 409 });
  }

  const updated = await prisma.dataAsset.update({ where: { id }, data: updateData });

  await prisma.auditLog.create({
    data: {
      entityType: "DataAsset", entityId: id,
      action: "DATA_ASSET_UPDATED",
      actorEmail: (auth as any).user.email,
      detail: JSON.stringify(updateData),
    },
  });

  return NextResponse.json(updated);
}
```

---

### 1-9. `app/api/admin/usage/expire-check/route.ts`

만료 배치. 일 1회 실행. EXPIRED 처리 + 에이전트 자동 SUSPENDED + 14일 전 알림.

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify, NotifyEvent } from "@/lib/notify";

const WARN_DAYS = 14;

/**
 * POST /api/admin/usage/expire-check
 * 데이터 제공 만료 배치 — 일 1회 실행 (v3 §10-3).
 * 1. expiresAt <= now → EXPIRED 처리 + 연결 PRODUCTION 에이전트 자동 SUSPENDED
 * 2. expiresAt <= now+14d → 만료 임박 알림 (requesterId 기준)
 */
export async function POST() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const now = new Date();
  const warnDate = new Date(now.getTime() + WARN_DAYS * 24 * 60 * 60 * 1000);

  // 1. 만료된 DataProvision 처리
  const expired = await prisma.dataProvision.findMany({
    where: { expiresAt: { lte: now }, revokedAt: null },
    include: { request: { include: { project: true } } },
  });

  let expiredCount = 0;
  let suspendedAgentCount = 0;
  for (const prov of expired) {
    await prisma.$transaction([
      prisma.dataProvision.update({ where: { id: prov.id }, data: { revokedAt: now, revokeReason: "이용기간 만료(자동 처리)" } }),
      prisma.dataRequest.update({ where: { id: prov.requestId }, data: { status: "EXPIRED" } }),
      prisma.auditLog.create({
        data: {
          entityType: "DataProvision", entityId: prov.id,
          action: "DATA_PROVISION_EXPIRED", actorEmail: "SYSTEM",
          detail: JSON.stringify({ expiresAt: prov.expiresAt, requestId: prov.requestId }),
        },
      }),
    ]);
    expiredCount++;

    // PRODUCTION 에이전트 자동 SUSPENDED (v3 §10-4)
    if (prov.request.projectId) {
      const prodAgent = await prisma.agentRegistry.findFirst({
        where: { projectId: prov.request.projectId, phase: "PRODUCTION", prodStatus: "ACTIVE" },
        select: { id: true },
      });
      if (prodAgent) {
        await prisma.agentRegistry.update({ where: { id: prodAgent.id }, data: { prodStatus: "SUSPENDED" } });
        await prisma.auditLog.create({
          data: {
            entityType: "AgentRegistry", entityId: prodAgent.id,
            action: "AGENT_AUTO_SUSPENDED_DATA_EXPIRED", actorEmail: "SYSTEM",
            detail: JSON.stringify({ provisionId: prov.id }),
          },
        });
        suspendedAgentCount++;
      }
    }
  }

  // 2. 만료 14일 전 임박 알림
  const warningSoon = await prisma.dataProvision.findMany({
    where: { expiresAt: { lte: warnDate, gt: now }, revokedAt: null },
    include: { request: { include: { project: { select: { requesterEmail: true, title: true } } } } },
  });

  const notifiedEmails = new Set<string>();
  for (const prov of warningSoon) {
    const email = prov.request.project?.requesterEmail;
    if (!email || notifiedEmails.has(email)) continue;
    notifiedEmails.add(email);
    const daysLeft = Math.ceil((prov.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    await notify({
      type: "DATA_REQUEST_UPDATE",
      title: "데이터 이용 기간 만료 임박",
      body: `'${prov.request.project?.title ?? ""}' 과제의 데이터 제공이 ${daysLeft}일 후 만료됩니다. 연장 신청을 검토하세요.`,
      link: "/me/data",
    } as NotifyEvent, [email]).catch(() => {});
  }

  return NextResponse.json({ ok: true, expiredCount, suspendedAgentCount, warningSentCount: notifiedEmails.size });
}
```

---

### 1-10. `app/api/admin/agents/inactive-check/route.ts`

12개월 미사용 PRODUCTION ACTIVE 에이전트 자동 DEPRECATED 배치.

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

const INACTIVE_MONTHS = 12;

/**
 * POST /api/admin/agents/inactive-check
 * 12개월 미사용(lastUsedAt <= now-12m 또는 null) PRODUCTION ACTIVE 에이전트 자동 DEPRECATED.
 * architecture v3 §7-2: "12개월 미사용 → AX팀 직권 DEPRECATED (협의회 사후 보고)"
 * 일 1회 실행 권장.
 */
export async function POST() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - INACTIVE_MONTHS);

  const targets = await prisma.agentRegistry.findMany({
    where: {
      phase: "PRODUCTION",
      prodStatus: "ACTIVE",
      OR: [{ lastUsedAt: { lte: cutoff } }, { lastUsedAt: null }],
    },
    select: { id: true, name: true, agentName: true, lastUsedAt: true },
  });

  if (targets.length === 0)
    return NextResponse.json({ ok: true, deprecatedCount: 0, message: "12개월 이상 미사용 에이전트 없음" });

  const now = new Date();
  let deprecatedCount = 0;
  for (const agent of targets) {
    await prisma.$transaction([
      prisma.agentRegistry.update({ where: { id: agent.id }, data: { prodStatus: "DEPRECATED" } }),
      prisma.auditLog.create({
        data: {
          entityType: "AgentRegistry", entityId: agent.id,
          action: "AGENT_AUTO_DEPRECATED_INACTIVE",
          actorEmail: "SYSTEM",
          detail: JSON.stringify({
            reason: `${INACTIVE_MONTHS}개월 이상 미사용`,
            lastUsedAt: agent.lastUsedAt ?? null,
            cutoff: cutoff.toISOString(),
            triggeredBy: auth.user.email,
          }),
        },
      }),
    ]);
    deprecatedCount++;
  }

  return NextResponse.json({
    ok: true,
    deprecatedCount,
    targets: targets.map((a) => ({ id: a.id, name: a.name ?? a.agentName ?? "(이름 없음)", lastUsedAt: a.lastUsedAt })),
  });
}

/**
 * GET /api/admin/agents/inactive-check
 * 12개월 미사용 후보 미리보기 (실제 처리 없음).
 */
export async function GET() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - INACTIVE_MONTHS);

  const candidates = await prisma.agentRegistry.findMany({
    where: {
      phase: "PRODUCTION", prodStatus: "ACTIVE",
      OR: [{ lastUsedAt: { lte: cutoff } }, { lastUsedAt: null }],
    },
    select: { id: true, name: true, agentName: true, lastUsedAt: true, prodStatus: true, productionAt: true },
    orderBy: { lastUsedAt: "asc" },
  });

  return NextResponse.json({ cutoff: cutoff.toISOString(), candidates });
}
```

---

## 2. 수정된 파일

---

### 2-1. `app/api/council/agenda/[id]/decide/route.ts` — Project.status 동기화 추가

기존 트랜잭션 배열에 아래 두 블록을 추가:

```typescript
// PROD_APPROVAL 승인 → 연결 과제 status = "production"
...(item.itemType === "PROD_APPROVAL" && decision === "APPROVED" && item.agent.projectId
  ? [prisma.project.update({ where: { id: item.agent.projectId }, data: { status: "production" } })]
  : []),
// PROD_APPROVAL 최종 반려(REJECTED) → 연결 과제 status = "closed"
...(item.itemType === "PROD_APPROVAL" && decision === "REJECTED" && item.agent.projectId
  ? [prisma.project.update({ where: { id: item.agent.projectId }, data: { status: "closed" } })]
  : []),
```

---

### 2-2. `app/api/council/agenda/[id]/conditions/route.ts` — 조건 전건 이행 시 동기화

```typescript
// 파일 상단: agent.projectId 사전 조회
const agent = await prisma.agentRegistry.findUnique({
  where: { id: item.agentId },
  select: { projectId: true },
});

// allDone 분기 트랜잭션 배열에 추가:
...(agent?.projectId
  ? [prisma.project.update({ where: { id: agent.projectId }, data: { status: "production" } })]
  : []),
```

전체 파일:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/** 조건 이행 체크 — 전건 이행 시 상용 전환 (재상정 불필요, v3 §8-2) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const { index, done } = await req.json();

  const item = await prisma.councilAgendaItem.findUnique({ where: { id } });
  if (!item || item.decision !== "CONDITIONAL" || !item.conditions)
    return NextResponse.json({ error: "조건부 승인 안건이 아닙니다" }, { status: 400 });

  const conds: { condition: string; done: boolean; checkedBy: string | null }[] = JSON.parse(item.conditions);
  if (index < 0 || index >= conds.length)
    return NextResponse.json({ error: "잘못된 조건 인덱스입니다" }, { status: 400 });
  conds[index] = { ...conds[index], done: Boolean(done), checkedBy: done ? auth.user.email : null };
  const allDone = conds.every((c) => c.done);

  const agent = await prisma.agentRegistry.findUnique({ where: { id: item.agentId }, select: { projectId: true } });

  await prisma.$transaction([
    prisma.councilAgendaItem.update({ where: { id: item.id }, data: { conditions: JSON.stringify(conds) } }),
    ...(allDone
      ? [
          prisma.agentRegistry.update({
            where: { id: item.agentId },
            data: { phase: "PRODUCTION", devStage: null, prodStatus: "ACTIVE", productionAt: new Date() },
          }),
          ...(agent?.projectId
            ? [prisma.project.update({ where: { id: agent.projectId }, data: { status: "production" } })]
            : []),
          prisma.auditLog.create({
            data: {
              entityType: "AgentRegistry", entityId: item.agentId,
              action: "COUNCIL_CONDITIONS_FULFILLED",
              actorEmail: auth.user.email,
              detail: JSON.stringify({ agendaItemId: item.id }),
            },
          }),
        ]
      : []),
  ]);
  return NextResponse.json({ ok: true, allDone });
}
```

---

### 2-3. `app/api/registry/route.ts` — GATE1→GATE2 선결 검증 + RETIRED DataProvision 전건 회수

**GATE2 전환 전 DataRequest 선결 검증 (추가 위치: lifecycleStage 처리 직전):**

```typescript
// GATE1 → GATE2 전환 시: 과제에 DataRequest가 있으면 전건 PROVISIONED여야 함 (v3 §10-4)
if (lifecycleStage === 'GATE2') {
  const current = await prisma.agentRegistry.findUnique({
    where: { id },
    select: { projectId: true, lifecycleStage: true }
  });
  if (current?.lifecycleStage === 'GATE1' && current.projectId) {
    const unprovisionedCount = await prisma.dataRequest.count({
      where: {
        projectId: current.projectId,
        status: { notIn: ['PROVISIONED', 'REJECTED', 'REVOKED'] },
      },
    });
    if (unprovisionedCount > 0) {
      return NextResponse.json(
        { error: `데이터 신청 ${unprovisionedCount}건이 미제공(PROVISIONED 미완료) 상태입니다. 데이터 제공 완료 후 GATE2로 전환하세요.` },
        { status: 422 }
      );
    }
  }
}
```

**RETIRED 전환 시 DataProvision 전건 회수 (추가 위치: lifecycleStage=RETIRED 처리 이후):**

```typescript
// RETIRED 전환 시 연결 과제의 PROVISIONED DataRequest 전건 회수 (v3 §10-4)
if (lifecycleStage === 'RETIRED' && agent.projectId) {
  const revokeNow = new Date();
  const dataRequests = await prisma.dataRequest.findMany({
    where: { projectId: agent.projectId, status: 'PROVISIONED' },
    select: { id: true },
  });
  const requestIds = dataRequests.map((r: { id: string }) => r.id);
  if (requestIds.length > 0) {
    await prisma.dataProvision.updateMany({
      where: { requestId: { in: requestIds }, revokedAt: null },
      data: { revokedAt: revokeNow, revokeReason: `에이전트 폐기(RETIRED): ${agent.agentName ?? id}` },
    });
    await prisma.dataRequest.updateMany({ where: { id: { in: requestIds } }, data: { status: 'REVOKED' } });
    await prisma.auditLog.create({
      data: {
        entityType: "AgentRegistry", entityId: id,
        action: "DATA_PROVISIONS_REVOKED_ON_RETIRE",
        actorEmail: auth.user.email,
        detail: JSON.stringify({ revokedRequestIds: requestIds }),
      },
    });
  }
}
```

---

### 2-4. `app/api/approve/[id]/route.ts` — 과제 반려 시 DataProvision 자동 회수

```typescript
// 과제 반려(reject) 시 PROVISIONED DataRequest 전건 자동 REVOKED (v3 §10-3)
if (typedAction === 'reject') {
  const revokeNow = new Date();
  const provisionedRequests = await prisma.dataRequest.findMany({
    where: { projectId: id, status: 'PROVISIONED' },
    select: { id: true },
  });
  const requestIds = provisionedRequests.map((r: { id: string }) => r.id);
  if (requestIds.length > 0) {
    await prisma.dataProvision.updateMany({
      where: { requestId: { in: requestIds }, revokedAt: null },
      data: { revokedAt: revokeNow, revokeReason: `과제 반려(REJECTED): ${id}` },
    });
    await prisma.dataRequest.updateMany({ where: { id: { in: requestIds } }, data: { status: 'REVOKED' } });
  }
}
```

---

### 2-5. `app/api/executive/route.ts` — agentPhaseSummary 추가

```typescript
// v3 개발/상용 에이전트 phase별 분리 요약 (별도 쿼리)
const [devCount, prodCount, suspendedCount, retireCandidateCount] = await Promise.all([
  prisma.agentRegistry.count({ where: { phase: 'DEVELOPMENT' } }),
  prisma.agentRegistry.count({ where: { phase: 'PRODUCTION', prodStatus: 'ACTIVE' } }),
  prisma.agentRegistry.count({ where: { phase: 'PRODUCTION', prodStatus: 'SUSPENDED' } }),
  prisma.agentRegistry.count({ where: { retireFlag: true } }),
]);

// 응답 JSON에 추가:
agentPhaseSummary: {
  development: devCount,
  productionActive: prodCount,
  productionSuspended: suspendedCount,
  retireCandidate: retireCandidateCount,
},
```

---

### 2-6. `app/api/admin/agents/flags/route.ts` — AgentRegistry.retireFlag 통합

```typescript
import { displayName } from '@/lib/council-eligibility';

// GET 핸들러 — legacyFlagged + registryFlagged 병렬 조회
const [legacyFlagged, registryFlagged] = await Promise.all([
  // 레거시 Agent 모델 (기존 performanceFlag)
  prisma.agent.findMany({
    where: { performanceFlag: { not: null } },
    select: { id: true, name: true, department: true, status: true,
              kpiName: true, kpiTarget: true, kpiLastScore: true, kpiMissCount: true,
              performanceFlag: true, lastUsedAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  }),
  // v3 AgentRegistry — retireFlag=true
  prisma.agentRegistry.findMany({
    where: { retireFlag: true },
    include: { scores: { where: { phase: 'PRODUCTION', month: { not: null } }, orderBy: { month: 'desc' }, take: 3 } },
    orderBy: { updatedAt: 'desc' },
  }),
]);

// ※ 수정: a.department → a.owner (AgentRegistry에 department 필드 없음)
const registryResult = registryFlagged.map((a) => ({
  id: a.id,
  name: displayName(a),
  department: a.owner ?? null,   // ← 핵심 수정 포인트
  phase: a.phase,
  lifecycleStage: a.lifecycleStage,
  prodStatus: a.prodStatus,
  performanceFlag: 'RETIRE_CANDIDATE',
  recentScores: a.scores.map((s) => ({ month: s.month, achieveRate: s.achieveRate })),
  updatedAt: a.updatedAt,
  source: 'AgentRegistry' as const,
}));

return NextResponse.json({ legacy: legacyFlagged, registry: registryResult });
```

---

### 2-7. `app/api/data/requests/[id]/route.ts` — PATCH 후 AuditLog 자동 기록

```typescript
// PATCH 후 처리:
await prisma.auditLog.create({
  data: {
    entityType: 'DataRequest',
    entityId: id,
    action: `DATA_REQUEST_${status}`,
    actorEmail: (session.user as any)?.email ?? 'unknown',
    detail: JSON.stringify({ status, rejectReason: rejectReason ?? null }),
  },
});
```

---

### 2-8. `app/api/data/requests/route.ts` — prevRequestId POST 지원

```typescript
// body 구조분해에 추가:
const { ..., prevRequestId } = body;

// prisma.dataRequest.create data에 추가:
...(prevRequestId ? { prevRequestId } : {}),
```

---

### 2-9. `app/api/data/provisions/route.ts` — 레거시 라우트 비활성화

```typescript
/**
 * @deprecated DATA_PLATFORM 역할 체크 없는 레거시 라우트. 비활성화됨.
 * 신규 코드는 /api/dp/requests/[id]/provision 을 사용하세요.
 * v3 §10-2: DATA_PLATFORM 역할 필수.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: '이 라우트는 비활성화되었습니다. /api/dp/requests/[id]/provision 을 사용하세요.' },
    { status: 410 }
  );
}
```

---

## 3. 아키텍처 대비 구현 현황

### 에이전트 라이프사이클 (§7)

| 요건 | 상태 |
|------|------|
| GATE1→GATE2 DataRequest PROVISIONED 선결 검증 | ✅ |
| RETIRE_CANDIDATE 자동 플래그 (3개월 연속 60% 미달) | ✅ |
| 12개월 미사용 자동 DEPRECATED | ✅ |
| RETIRED 시 DataProvision 전건 REVOKED | ✅ |
| 과제 반려 시 DataProvision 자동 REVOKED | ✅ |

### 협의회 (§8)

| 요건 | 상태 |
|------|------|
| 상정 요건 5종 자동 검증 | ✅ |
| 심의 패키지 조회 API | ✅ |
| 의결 후 Project.status 동기화 (production/closed) | ✅ |
| 조건부 승인 조건 이행 추적 | ✅ |
| 조건 전건 이행 시 PRODUCTION 자동 전환 | ✅ |

### 데이터 프로비저닝 (§10)

| 요건 | 상태 |
|------|------|
| REQUESTED → REVIEWING 접수 | ✅ |
| REVIEWING → SEC_REVIEW (G3) | ✅ |
| 승인/반려 (G3 isEssentialBusiness 선결) | ✅ |
| NEW 유형 → COLLECTING | ✅ |
| 제공 실행 (DataProvision 생성) | ✅ |
| connectionRef 시크릿 키만 저장 | ✅ |
| 제공 회수 + 에이전트 자동 SUSPENDED | ✅ |
| 만료 배치 (일 1회) | ✅ |
| 만료 14일 전 알림 | ✅ |
| 카탈로그 조회/등록/수정 | ✅ |
| 전체 신청 큐 (DATA_PLATFORM) | ✅ |
| 레거시 /api/data/provisions 비활성화 | ✅ |

### 경영진 대시보드 (§13)

| 요건 | 상태 |
|------|------|
| 개발중/상용 에이전트 분리 요약 | ✅ |
| SUSPENDED/RETIRE_CANDIDATE 수 포함 | ✅ |

### 감사 로그 (전건)

| 대상 | 상태 |
|------|------|
| DataRequest 모든 상태 전이 | ✅ |
| DataProvision 생성/회수/만료 | ✅ |
| AgentRegistry 자동 SUSPENDED/DEPRECATED | ✅ |
| RETIRE_CANDIDATE 자동 플래그 | ✅ |
| DataAsset 등록/수정 | ✅ |

---

## 4. 미결 사항

| 항목 | 우선순위 |
|------|----------|
| G3 신청서 Claude API 전송 — 마스킹/선판정 방식 미확정 | P1 |
| 이의제기 API/UI 미완성 (`/appeals` 라우트만 존재) | P1 |
| `/council/agenda/[id]` 프론트엔드 심의 패키지 상세 페이지 | P2 |
| 협의회 APPROVED 시 파일럿 DataProvision 자동 만료 처리 | P2 |
| 보안 이슈 (배포 전): bcrypt auth, 트랜잭션 approve, requireRole isActive 체크 | 배포 직전 |
| 리터러시 레벨 자동 평가 (현재 수동) | P3 |
| 모바일 반응형 | P3 |

---

## 5. 배치 운영 가이드

| 배치 | 엔드포인트 | 권한 | 주기 | 비고 |
|------|-----------|------|------|------|
| 데이터 제공 만료 처리 | `POST /api/admin/usage/expire-check` | AX_TEAM | 일 1회 | EXPIRED + 14일 전 알림 + 에이전트 자동 SUSPENDED |
| 12개월 미사용 DEPRECATED | `POST /api/admin/agents/inactive-check` | AX_TEAM | 일 1회 | 미리보기: `GET` |
| RETIRE_CANDIDATE 자동 플래그 | KPI 입력 시 자동 | — | 월별 KPI 입력 시점 | `POST /api/registry/[id]/kpi-score` 응답에 retireFlagSet 포함 |

---

## TypeScript 검증

```
$ npx tsc --noEmit   (C:\project\ax-team\ax-request-hub)
(출력 없음 — 에러 없음)
Exit code: 0
```

---

*전체 코드 문서 끝 — 2026-08-24*
