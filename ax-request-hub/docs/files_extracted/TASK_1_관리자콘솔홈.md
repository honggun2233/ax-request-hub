# 작업지시서 1: AX팀 콘솔 홈 (5개 업무 영역 보드)

> Claude Code 실행용. 위에서부터 순서대로 수행하라.
> 대상 레포: ax-request-hub (Next.js 16 App Router + Prisma 6 + SQLite + shadcn/ui)
> 선행 조건: v3.1 패키지 적용 완료 (lib/authz.ts, /me 리디자인 등)

## 배경과 관리 철학 (구현 판단의 기준)

AX팀 업무는 5개 영역이다: ①AI 전략·거버넌스 ②PI 지원 ③AI 확산·리터러시 ④파일럿 개발 ⑤Agent·자원 관리.
기능 화면은 다 있으나 이 축으로 모아 보는 홈이 없다. 단, 다음 철학을 반드시 지킨다:

- **"볼 게 없으면 좋은 날"** — 정상이면 조용한 화면. 예외·대기가 없으면 해당 요소는 렌더링하지 않는다.
- **건수만, 평가성 지표 금지** — 평균 처리일, SLA, 체류일, 부서 저조 순위 같은 지표를 만들지 않는다.
  이의제기·레벨 심사 등은 프로세스의 안전밸브이지 성과 관리 대상이 아니다.
- **빨간 신호는 1등급(지켜야 하는 것)에만** — 데이터 만료 임박 등. 나머지는 무색 숫자.

## 작업 범위

- [ ] 1. `app/api/admin/console-summary/route.ts` 신규 생성 (§코드 A)
- [ ] 2. `app/admin/page.tsx` (관리자 홈) 를 §코드 B 로 교체
- [ ] 3. `components/app-sidebar.tsx` 의 "과제 운영" 그룹 맨 위에
      `{ href: "/admin", label: "AX팀 콘솔", icon: LayoutDashboard }` 추가 (lucide LayoutDashboard import)
- [ ] 4. `npx tsc --noEmit` 및 `npm run build` 통과
- [ ] 5. §수용 기준 확인

## 사전 확인

1. `governanceDoc.status` 값에 "draft"가 실제 사용되는지 확인 (`grep -rn '"draft"' app --include="*.ts*"` 또는 시드 확인).
   미사용이면 draft 카운트는 0으로 나올 뿐 — 코드 수정 불필요.
2. Project 에스컬레이션 대기 상태값 확인: 코드 A는 `status: "evaluated"` 를 "AX팀 검토 대기"로 가정.
   실제 승인 API가 status를 무엇으로 바꾸는지 확인해 필요 시 where만 조정.
3. `/dashboard?tab=requests` 탭이 없으면 "기타 요청" 링크는 `/dashboard` 로 폴백해도 된다.

## 하지 말 것

- 새 지표를 추가하지 않는다 (특히 시간·비율 기반 평가 지표). 코드 A에 있는 것이 전부다.
- 스키마 변경 없음. PI 카드의 "효과 실현"은 BenefitRecord 미도입 시 "— (집계 준비 중)"으로
  표시되도록 이미 방어되어 있다 (작업지시서 2와 독립적으로 배포 가능).
- KPI 미입력 에이전트를 콘솔에 표시하지 않는다 — 이는 담당자 개인 알림 영역 (추후 별도 작업).

## 수용 기준

1. 대기가 전혀 없는 상태 → 처리 대기함에 "처리 대기 없음" 한 줄, 예외 카드 미표시, 5칸 전부 무색 숫자.
2. 만료 14일 내 DataProvision 1건 존재 → 상단에 빨간 예외 1행 (그 외 어디에도 빨강 없음).
3. 처리 대기함의 각 숫자 클릭 → 해당 처리 화면으로 이동. "기타 요청"에 hover 시
   이의제기·레벨·도구 내역이 title 툴팁으로 보인다.
4. 화면 어디에도 평균 처리일·체류일·부서명 순위가 없다.

## 완료 보고 형식

- 사전 확인 2의 판정 (에스컬레이션 상태값, 근거 파일:줄)
- 변경 파일 목록 · tsc/빌드 결과 · 수용 기준 4건 결과

---

## 코드 A — `app/api/admin/console-summary/route.ts` (신규)

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * AX팀 콘솔 홈 요약 — 관리 철학:
 * ① 지켜야 하는 것(1등급)만 예외(exceptions)로 올린다 — 데이터 만료·회수 등
 * ② 흘러가야 하는 것은 "건수만" — 평균 처리일·SLA·체류일 같은 평가성 지표를 만들지 않는다
 * ③ 알면 좋은 것(확산 상세 등)은 홈에 올리지 않는다
 * 정상이면 조용한 화면이 정답이다.
 */
export async function GET() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const soon = new Date(now.getTime() + 14 * 24 * 3600 * 1000);

  const [
    evaluationWaiting, conditionalItems, dataWaiting,
    appealsPending, levelPending, toolPending,
    draftDocs, g3ThisMonth,
    activeProjects,
    activeToolAccounts, quotas, l2Plus,
    stageRows,
    productionActive, expiringProvisions,
  ] = await Promise.all([
    prisma.project.count({ where: { status: "evaluated" } }),
    prisma.councilAgendaItem.findMany({ where: { decision: "CONDITIONAL", conditions: { not: null } } }),
    prisma.dataRequest.count({ where: { status: { in: ["REQUESTED", "REVIEWING", "SEC_REVIEW"] } } }),
    prisma.projectAppeal.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW"] } } }),
    prisma.levelApplication.count({ where: { status: "PENDING" } }),
    prisma.toolAccount.count({ where: { status: "PENDING" } }),
    prisma.governanceDoc.count({ where: { status: "draft" } }),
    prisma.project.count({ where: { confidentialityLevel: "G3", createdAt: { gte: monthStart } } }),
    prisma.project.findMany({
      where: { status: { in: ["approved", "pilot"] } },
      select: { department: true },
    }),
    prisma.toolAccount.count({ where: { status: "ACTIVE" } }),
    prisma.departmentQuota.findMany({ select: { totalQuota: true } }),
    prisma.employee.count({ where: { isActive: true, currentLevel: { in: ["L2", "L3", "L4"] } } }),
    prisma.agentRegistry.groupBy({ by: ["devStage"], where: { phase: "DEVELOPMENT" }, _count: true }),
    prisma.agentRegistry.count({ where: { phase: "PRODUCTION", prodStatus: "ACTIVE" } }),
    prisma.dataProvision.findMany({
      where: { revokedAt: null, expiresAt: { lte: soon, gte: now } },
      include: { request: { include: { asset: { select: { name: true } } } } },
    }),
  ]);

  // 조건부 승인 — 미이행 조건이 남은 안건 수
  const councilConditions = conditionalItems.filter((i) => {
    try { return (JSON.parse(i.conditions!) as { done: boolean }[]).some((c) => !c.done); }
    catch { return false; }
  }).length;

  const stageCount = (s: string) => stageRows.find((r) => r.devStage === s)?._count ?? 0;

  // PI 효과 실현 — BenefitRecord 도입(별도 작업) 전에는 null → 화면은 "—" 표시
  let benefitRealizedPct: number | null = null;
  try {
    const anyPrisma = prisma as any;
    if (anyPrisma.benefitRecord) {
      const recs = await anyPrisma.benefitRecord.findMany({ select: { realizedValue: true, projectId: true } });
      const projs = await prisma.project.findMany({
        where: { id: { in: recs.map((r: any) => r.projectId) } },
        select: { id: true, expectedBenefitValue: true } as any,
      });
      const expected = projs.reduce((s: number, p: any) => s + (p.expectedBenefitValue ?? 0), 0);
      const realized = recs.reduce((s: number, r: any) => s + r.realizedValue, 0);
      benefitRealizedPct = expected > 0 ? Math.round((realized / expected) * 100) : null;
    }
  } catch { /* 모델 미도입 — 정상 */ }

  // ── 1등급 예외만 (없으면 빈 배열 → 화면에서 섹션 미표시) ──
  const exceptions = expiringProvisions.map((p) => {
    const d = Math.max(0, Math.ceil((p.expiresAt.getTime() - now.getTime()) / 86400000));
    return {
      text: `데이터 제공 만료 임박 — '${p.request.asset?.name ?? "자산"}' ${d}일 남음`,
      link: "/dp/requests",
    };
  });

  return NextResponse.json({
    queue: {
      evaluation: evaluationWaiting,
      councilConditions,
      dataRequests: dataWaiting,
      misc: {
        total: appealsPending + levelPending + toolPending,
        appeals: appealsPending, levelApps: levelPending, tools: toolPending,
      },
    },
    cards: {
      governance: { draftDocs, g3ThisMonth },
      pi: {
        activeDepartments: new Set(activeProjects.map((p) => p.department)).size,
        activeProjects: activeProjects.length,
        benefitRealizedPct,
      },
      adoption: {
        activeToolAccounts,
        totalQuota: quotas.reduce((s, q) => s + q.totalQuota, 0),
        l2Plus,
      },
      pilot: {
        gate1: stageCount("GATE1"),
        gate2: stageCount("GATE2"),
        gate3: stageCount("GATE3") + stageCount("PILOT_PROVEN"),
        council: stageCount("COUNCIL_PENDING") + stageCount("COND_APPROVED"),
      },
      resource: { productionActive },
    },
    exceptions,
  });
}
```

## 코드 B — `app/admin/page.tsx` (전체 교체)

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

type Summary = {
  queue: {
    evaluation: number; councilConditions: number; dataRequests: number;
    misc: { total: number; appeals: number; levelApps: number; tools: number };
  };
  cards: {
    governance: { draftDocs: number; g3ThisMonth: number };
    pi: { activeDepartments: number; activeProjects: number; benefitRealizedPct: number | null };
    adoption: { activeToolAccounts: number; totalQuota: number; l2Plus: number };
    pilot: { gate1: number; gate2: number; gate3: number; council: number };
    resource: { productionActive: number };
  };
  exceptions: { text: string; link: string }[];
};

/**
 * AX팀 콘솔 홈 — "볼 게 없으면 좋은 날" 원칙.
 * 처리 대기함은 건수만, 5영역 카드는 현황 숫자만, 빨간 예외는 1등급(지켜야 하는 것)뿐.
 */
export default function AdminConsolePage() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    fetch("/api/admin/console-summary").then((r) => r.json()).then(setS).catch(() => {});
  }, []);
  if (!s) return <p className="p-6 text-sm text-muted-foreground">불러오는 중…</p>;

  const q = s.queue;
  const queueItems = [
    { label: "평가 대기", n: q.evaluation, href: "/dashboard" },
    { label: "협의회 조건 이행", n: q.councilConditions, href: "/council" },
    { label: "데이터 요청", n: q.dataRequests, href: "/dp/requests" },
    { label: "기타 요청", n: q.misc.total, href: "/dashboard?tab=requests",
      title: `이의제기 ${q.misc.appeals} · 레벨 심사 ${q.misc.levelApps} · 도구 승인 ${q.misc.tools}` },
  ].filter((i) => i.n > 0);

  const totalQueue = queueItems.reduce((sum, i) => sum + i.n, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">AX팀 콘솔</h1>
        <p className="text-xs text-muted-foreground">숫자를 누르면 처리 화면으로 이동합니다</p>
      </div>

      {/* 1등급 예외 — 있을 때만 */}
      {s.exceptions.length > 0 && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="space-y-1 p-4">
            {s.exceptions.map((e, i) => (
              <Link key={i} href={e.link} className="flex items-center gap-2 text-sm text-red-700 hover:underline dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />{e.text}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 처리 대기함 — 건수만, 0이면 항목 자체가 사라진다 */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
          <p className="text-xs font-semibold text-muted-foreground">처리 대기함</p>
          {totalQueue === 0 ? (
            <p className="text-sm text-muted-foreground">처리 대기 없음</p>
          ) : (
            queueItems.map((i) => (
              <Link key={i.label} href={i.href} title={i.title}
                className="text-sm hover:underline">
                {i.label} <b>{i.n}</b>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* 업무 영역 5칸 — 현황 숫자만 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/governance">
          <Card className="h-full transition-colors hover:bg-accent/40"><CardContent className="p-4">
            <p className="text-xs font-semibold text-primary">① 전략 · 거버넌스</p>
            <p className="mt-2 text-sm">문서 개정 대기 <b>{s.cards.governance.draftDocs}</b>건</p>
            <p className="mt-0.5 text-sm text-muted-foreground">이번 달 G3 과제 {s.cards.governance.g3ThisMonth}건</p>
          </CardContent></Card>
        </Link>

        <Link href="/dashboard">
          <Card className="h-full transition-colors hover:bg-accent/40"><CardContent className="p-4">
            <p className="text-xs font-semibold text-primary">② PI 지원</p>
            <p className="mt-2 text-sm">개선 진행 <b>{s.cards.pi.activeDepartments}</b>개 부서 · 과제 {s.cards.pi.activeProjects}건</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              효과 실현 {s.cards.pi.benefitRealizedPct !== null ? `${s.cards.pi.benefitRealizedPct}%` : "— (집계 준비 중)"}
            </p>
          </CardContent></Card>
        </Link>

        <Link href="/admin/employees">
          <Card className="h-full transition-colors hover:bg-accent/40"><CardContent className="p-4">
            <p className="text-xs font-semibold text-primary">③ 확산 · 리터러시</p>
            <p className="mt-2 text-sm">도구 활성 <b>{s.cards.adoption.activeToolAccounts}</b>/{s.cards.adoption.totalQuota || "—"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">L2 이상 {s.cards.adoption.l2Plus}명</p>
          </CardContent></Card>
        </Link>

        <Link href="/registry">
          <Card className="h-full transition-colors hover:bg-accent/40"><CardContent className="p-4">
            <p className="text-xs font-semibold text-primary">④ 파일럿 개발</p>
            <p className="mt-2 text-sm">
              G1 <b>{s.cards.pilot.gate1}</b> · G2 <b>{s.cards.pilot.gate2}</b> · G3 <b>{s.cards.pilot.gate3}</b>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">협의회 단계 {s.cards.pilot.council}건</p>
          </CardContent></Card>
        </Link>

        <Link href="/registry?tab=production">
          <Card className="h-full transition-colors hover:bg-accent/40"><CardContent className="p-4">
            <p className="text-xs font-semibold text-primary">⑤ Agent · 자원</p>
            <p className="mt-2 text-sm">상용 <b>{s.cards.resource.productionActive}</b> 운영 중</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{s.exceptions.length === 0 ? "이상 없음" : "상단 예외 확인"}</p>
          </CardContent></Card>
        </Link>
      </div>
    </div>
  );
}
```
