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
    { label: "기타 요청", n: q.misc.total, href: "/dashboard",
      title: `이의제기 ${q.misc.appeals} · 레벨 심사 ${q.misc.levelApps} · 도구 승인 ${q.misc.tools}` },
  ].filter((i) => i.n > 0);

  const totalQueue = queueItems.reduce((sum, i) => sum + i.n, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">AX팀 콘솔</h1>
        <p className="text-xs text-muted-foreground">숫자를 누르면 처리 화면으로 이동합니다</p>
      </div>

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
