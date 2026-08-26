# 작업지시서: /me 내 정보 페이지 리디자인 (한눈 대시보드)

> 이 문서는 Claude Code 실행용 작업지시서다. 위에서부터 순서대로 수행하라.
> 대상 레포: ax-request-hub (Next.js 16 App Router + Prisma 6 + SQLite + shadcn/ui)

## 배경 (왜 하는가)

사용자 피드백: "내 정보가 한눈에 안 들어온다."
원인: /me가 정보를 하위 7개 페이지(level, literacy, services, tools, usage, data, projects)에
나눠놓기만 하고 모아주는 화면이 없다. 중요한 일(데이터 만료 임박 등)도 해당 하위 페이지를
직접 열어본 사람만 알 수 있다.

해결: /me 첫 화면을 "한눈 대시보드"로 교체한다.
1. 위→아래 = 중요도: ①정체성 스트립 → ②다음 할 일 → ③요약 카드 3장 → ④교육 한 줄
2. 모든 카드는 기존 하위 페이지로 들어가는 진입점 (하위 페이지는 삭제하지 않는다)
3. 숫자 먼저, 설명 나중. "다음 할 일"은 실데이터에서 파생되며 없으면 섹션 자체를 렌더링하지 않는다

## 작업 범위

- [ ] 1. 사전 확인 (아래 §사전 확인 3건)
- [ ] 2. `app/api/me/summary/route.ts` 를 §코드 A 로 교체
- [ ] 3. `app/me/page.tsx` 를 §코드 B 로 교체
- [ ] 4. 타입체크·빌드 통과 (`npx tsc --noEmit` 및 `npm run build`)
- [ ] 5. §수용 기준 5개 시나리오 확인

## 사전 확인 (코드 수정 전에 반드시)

1. **DataRequest.requesterId 저장 관례 확인** — 이 값이 이메일인지 Employee.id인지 코드베이스에서 확인하라:
   `grep -rn "requesterId" app/api/data --include="*.ts"` 로 DataRequest 생성부를 찾아
   무엇을 넣는지 본다. **이메일이면 코드 A 그대로**, Employee.id면 코드 A의
   `where: { requesterId: me.email }` 을 `me.id` 로 바꾼다.
2. **의존 모듈 존재 확인** — 다음이 이미 존재해야 한다 (v3.1 패키지로 적용됨):
   `lib/authz.ts`(requireRole), `lib/lifecycle-labels.ts`(friendlyAgentStatus 등),
   `components/status-badge.tsx`(StatusBadge). 없으면 중단하고 보고하라.
   import 경로 별칭(@/)이 다르면 실제 tsconfig paths에 맞춰 조정한다.
3. **shadcn 컴포넌트 확인** — `components/ui/card.tsx` 존재 확인. 없으면 `npx shadcn@latest add card`.

## 하지 말 것

- 하위 페이지(/me/level, /me/literacy, /me/tools, /me/usage, /me/services, /me/data, /me/projects)를
  삭제·이동하지 않는다. 카드가 그리로 링크한다.
- 스키마 변경 없음 — 이 작업에 마이그레이션은 필요 없다.
- 지시된 두 파일 외의 파일은 수정하지 않는다 (import 경로 조정 제외).

## 수용 기준

1. 과제 2건(하나는 COUNCIL_PENDING 단계 에이전트 연결) 보유 직원으로 /me 접속 →
   과제 카드에 "2건 진행 중" + "정식 운영 심의 중" 라벨. GATE·devStage 같은 내부 코드는 화면에 없다.
2. 만료 13일 남은 DataProvision 보유 → "다음 할 일"에 만료 행 노출 + 데이터 카드에 "1건 만료 임박".
3. CONDITIONAL 의결에 done=false 조건 존재 → "다음 할 일"에 해당 조건 텍스트 노출.
4. 신입(과제·데이터·도구·수강 전무) → "다음 할 일" 섹션이 렌더링되지 않고,
   각 카드에 빈 상태 문구가 나오며 화면이 깨지지 않는다.
5. 이번 달 토큰 사용 80% 이상 → 사용량 바가 주황색 + "한도 임박" 문구.

## 완료 보고 형식

- 사전 확인 1의 판정 결과 (requesterId = 이메일 / Employee.id, 근거 파일:줄)
- 변경 파일 목록과 조정한 import 경로
- tsc/빌드 결과
- 수용 기준 5건 확인 결과 (시드 데이터로 확인 가능한 범위)

---

## 코드 A — `app/api/me/summary/route.ts` (전체 교체)

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { friendlyAgentStatus, PROJECT_STATUS_LABELS, DATA_REQUEST_LABELS } from "@/lib/lifecycle-labels";

/** 내 정보 대시보드 요약 — 페이지가 필요한 모든 것을 1회 호출로 반환 */
export async function GET() {
  const auth = await requireRole();
  if ("error" in auth) return auth.error;
  const me = auth.user;
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7); // "2026-07"
  const soon = new Date(now.getTime() + 14 * 24 * 3600 * 1000);

  const emp = await prisma.employee.findUnique({ where: { id: me.id } });
  const currentLevel = emp?.currentLevel ?? "L0";

  const [pendingLevelApp, myProjects, myDataRequests, myTools, myUsage, tokenPolicies, requiredCourses, myEnrollments] =
    await Promise.all([
      prisma.levelApplication.findFirst({
        where: { employeeId: me.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.project.findMany({
        where: { requesterEmail: me.email },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.dataRequest.findMany({
        // ⚠️ requesterId 저장 관례 확인: email이면 me.email, Employee.id면 me.id
        where: { requesterId: me.email },
        include: { provision: true, asset: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.toolAccount.findMany({
        where: { employeeId: me.id, status: { in: ["ACTIVE", "APPROVED"] } },
      }),
      prisma.usageRecord.findMany({ where: { employeeId: me.id, yearMonth } }),
      prisma.tokenPolicy.findMany({
        where: {
          isActive: true,
          OR: [
            { scope: "EMPLOYEE", employeeId: me.id },
            { scope: "LEVEL", level: currentLevel },
          ],
        },
      }),
      prisma.literacyCourse.findMany({ where: { isRequired: true, isActive: true } }),
      prisma.literacyEnrollment.findMany({ where: { employeeId: me.id } }),
    ]);

  // ── 과제: 에이전트 단계까지 반영한 친화 상태 ──
  const projectIds = myProjects.map((p) => p.id);
  const myAgents = projectIds.length
    ? await prisma.agentRegistry.findMany({ where: { projectId: { in: projectIds } } })
    : [];
  const agentByProject = Object.fromEntries(myAgents.filter((a) => a.projectId).map((a) => [a.projectId!, a]));
  const projects = myProjects.map((p) => {
    const a = agentByProject[p.id];
    const info = a
      ? friendlyAgentStatus(a.phase, a.devStage, a.prodStatus)
      : PROJECT_STATUS_LABELS[p.status] ?? { label: p.status, step: 0, tone: "default" as const };
    return { id: p.id, title: p.title, label: info.label, tone: info.tone, step: info.step };
  });
  const activeProjects = projects.filter((p) => !["반려됨", "운영 종료", "종료"].includes(p.label));

  // ── 데이터: 제공 중 / 만료 임박 / 검토 중 ──
  const provisioned = myDataRequests.filter(
    (r) => r.status === "PROVISIONED" && r.provision && !r.provision.revokedAt
  );
  const expiringSoon = provisioned.filter((r) => r.provision!.expiresAt <= soon);
  const inReview = myDataRequests.filter((r) =>
    ["REQUESTED", "REVIEWING", "SEC_REVIEW", "APPROVED", "COLLECTING"].includes(r.status)
  );

  // ── 도구·사용량 ──
  const TOOL_LABEL: Record<string, string> = { GPT_CHAT: "GPT Chat", GPT_EXCEL: "GPT Excel", GEMINI: "Gemini" };
  const tools = [...new Set(myTools.map((t) => TOOL_LABEL[t.toolType] ?? t.toolType))];
  const tokenUsed = myUsage.reduce((s, u) => s + u.tokenUsed, 0);
  const monthlyLimit = tokenPolicies.reduce((s, p) => s + p.monthlyLimit, 0) || null;
  const usagePct = monthlyLimit ? Math.min(100, Math.round((tokenUsed / monthlyLimit) * 100)) : null;

  // ── 교육 ──
  const doneCourseIds = new Set(myEnrollments.filter((e) => e.status === "COMPLETED").map((e) => e.courseId));
  const requiredDone = requiredCourses.filter((c) => doneCourseIds.has(c.id)).length;
  const nextCourse = requiredCourses.find((c) => !doneCourseIds.has(c.id));

  // ── 조건부 승인 미이행 조건 (내 에이전트) ──
  const condItems = myAgents.length
    ? await prisma.councilAgendaItem.findMany({
        where: { agentId: { in: myAgents.map((a) => a.id) }, decision: "CONDITIONAL", conditions: { not: null } },
      })
    : [];
  const openConditions = condItems.flatMap((i) => {
    try {
      return (JSON.parse(i.conditions!) as { condition: string; done: boolean }[]).filter((c) => !c.done);
    } catch {
      return [];
    }
  });

  // ── 다음 할 일 (파생 규칙 — 없으면 빈 배열 → 페이지에서 섹션 숨김) ──
  const todos: { text: string; link: string; tone: "warning" | "accent" }[] = [];
  for (const r of expiringSoon.slice(0, 2)) {
    const d = Math.max(0, Math.ceil((r.provision!.expiresAt.getTime() - now.getTime()) / 86400000));
    todos.push({ text: `'${r.asset?.name ?? "데이터"}' 이용기간이 ${d}일 후 만료 — 연장 신청`, link: "/me/data", tone: "warning" });
  }
  for (const c of openConditions.slice(0, 2))
    todos.push({ text: `조건부 승인 조건 이행 필요 — ${c.condition}`, link: "/me/projects", tone: "accent" });
  if (nextCourse)
    todos.push({ text: `필수 교육 '${nextCourse.title}' 미이수`, link: "/me/literacy", tone: "accent" });

  return NextResponse.json({
    profile: { name: me.name, department: emp?.department ?? me.department, jobTitle: emp?.jobTitle ?? "" },
    level: { current: currentLevel, pendingApplication: pendingLevelApp?.requestedLevel ?? null },
    todos: todos.slice(0, 3),
    projects: { activeCount: activeProjects.length, recent: activeProjects.slice(0, 2) },
    data: {
      provisionedCount: provisioned.length,
      expiringSoonCount: expiringSoon.length,
      inReviewCount: inReview.length,
      inReviewLabel: inReview[0] ? DATA_REQUEST_LABELS[inReview[0].status] ?? inReview[0].status : null,
    },
    tools: { names: tools, tokenUsed, monthlyLimit, usagePct },
    literacy: { requiredDone, requiredTotal: requiredCourses.length, nextCourse: nextCourse?.title ?? null },
  });
}
```

## 코드 B — `app/me/page.tsx` (전체 교체)

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { Tone } from "@/lib/lifecycle-labels";

type Summary = {
  profile: { name: string; department: string; jobTitle: string };
  level: { current: string; pendingApplication: string | null };
  todos: { text: string; link: string; tone: "warning" | "accent" }[];
  projects: { activeCount: number; recent: { id: string; title: string; label: string; tone: Tone }[] };
  data: { provisionedCount: number; expiringSoonCount: number; inReviewCount: number; inReviewLabel: string | null };
  tools: { names: string[]; tokenUsed: number; monthlyLimit: number | null; usagePct: number | null };
  literacy: { requiredDone: number; requiredTotal: number; nextCourse: string | null };
};

/**
 * 내 정보 — 한눈 대시보드.
 * 원칙: ① 위→아래 = 중요도 (정체성 → 다음 할 일 → 요약 카드 → 교육)
 *       ② 모든 카드는 상세로 들어가는 진입점
 *       ③ 숫자 먼저, 설명 나중. 할 일이 없으면 그 섹션은 사라진다.
 */
export default function MePage() {
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/me/summary")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setS)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="p-6 text-sm text-muted-foreground">내 정보를 불러오지 못했습니다. 새로고침해 주세요.</p>;
  if (!s) return <p className="p-6 text-sm text-muted-foreground">불러오는 중…</p>;

  const initials = s.profile.name.slice(-2); // 한국어 이름 뒤 2글자

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">

      {/* ① 정체성 스트립 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
            {initials}
          </div>
          <div>
            <p className="font-semibold">
              {s.profile.name}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                · {s.profile.department}{s.profile.jobTitle ? ` · ${s.profile.jobTitle}` : ""}
              </span>
            </p>
            <Link href="/me/level" className="text-xs text-muted-foreground hover:text-foreground">
              레벨 상세 보기 <ChevronRight className="inline h-3 w-3" />
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{s.level.current}</span>
          {s.level.pendingApplication && (
            <StatusBadge label={`${s.level.pendingApplication} 심사 진행 중`} tone="warning" />
          )}
        </div>
      </div>

      {/* ② 다음 할 일 — 없으면 렌더링하지 않는다 */}
      {s.todos.length > 0 && (
        <Card>
          <CardContent className="space-y-1.5 p-4">
            <p className="text-xs font-semibold text-muted-foreground">다음 할 일 ({s.todos.length})</p>
            {s.todos.map((t, i) => (
              <Link key={i} href={t.link}
                className={`flex items-center justify-between gap-2 rounded-md border-l-[3px] py-1.5 pl-3 pr-2 text-sm transition-colors hover:bg-accent/40 ${
                  t.tone === "warning" ? "border-amber-400" : "border-primary"
                }`}>
                <span>{t.text}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ③ 요약 카드 3장 — 숫자 먼저, 클릭 = 상세 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/me/projects">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">내 과제</p>
              <p className="mt-1.5 text-2xl font-semibold">
                {s.projects.activeCount}
                <span className="ml-1 text-xs font-normal text-muted-foreground">건 진행 중</span>
              </p>
              <div className="mt-1.5 space-y-0.5">
                {s.projects.recent.map((p) => (
                  <p key={p.id} className="truncate text-xs">
                    {p.title} — <span className={p.tone === "warning" ? "text-amber-600" : p.tone === "success" ? "text-green-600" : "text-primary"}>{p.label}</span>
                  </p>
                ))}
                {s.projects.activeCount === 0 && <p className="text-xs text-muted-foreground">신청한 과제가 없습니다</p>}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/me/data">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">내 데이터</p>
              <p className="mt-1.5 text-2xl font-semibold">
                {s.data.provisionedCount}
                <span className="ml-1 text-xs font-normal text-muted-foreground">건 제공 중</span>
              </p>
              <div className="mt-1.5 space-y-0.5 text-xs">
                {s.data.expiringSoonCount > 0 && <p className="text-amber-600">{s.data.expiringSoonCount}건 만료 임박</p>}
                {s.data.inReviewCount > 0 && (
                  <p className="text-muted-foreground">{s.data.inReviewCount}건 {s.data.inReviewLabel ?? "검토 중"}</p>
                )}
                {s.data.provisionedCount + s.data.inReviewCount === 0 && (
                  <p className="text-muted-foreground">데이터 신청 내역이 없습니다</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/me/tools">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">AI 도구 · 이번 달 사용량</p>
              <p className="mt-1.5 truncate text-sm font-medium">
                {s.tools.names.length ? s.tools.names.join(" · ") : "배정된 도구 없음"}
              </p>
              {s.tools.usagePct !== null ? (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${s.tools.usagePct >= 80 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${s.tools.usagePct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    토큰 {s.tools.usagePct}% 사용{s.tools.usagePct >= 80 ? " — 한도 임박" : " (한도 내)"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  이번 달 {s.tools.tokenUsed.toLocaleString()} 토큰 사용
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ④ 교육 — 한 줄 */}
      <Link href="/me/literacy" className="block">
        <Card className="transition-colors hover:bg-accent/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
            <p className="text-sm">
              <span className="font-medium">교육</span> · 필수 과정 {s.literacy.requiredDone}/{s.literacy.requiredTotal} 이수
              {s.literacy.nextCourse && <span className="text-muted-foreground"> — '{s.literacy.nextCourse}' 남음</span>}
            </p>
            <span className="flex items-center gap-1 text-xs text-primary">
              {s.literacy.nextCourse ? "이어서 수강" : "수강 내역 보기"} <ArrowRight className="h-3 w-3" />
            </span>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
```

---

## 참고: "다음 할 일" 규칙 확장 방법 (이번 작업 범위 아님)

todos 블록에 규칙을 한 줄씩 추가하면 된다. 예: 이의제기 결과 도착, 파일럿 KPI 입력 기한 등.
이 패턴(요약 API 1개 + 한눈 페이지)은 이후 직원 홈(/), 부서장 /dept, DP팀 /dp 홈에 동일 적용 예정.
