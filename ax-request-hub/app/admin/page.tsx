"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

type Appeal = { id: string; projectId: string; projectTitle?: string; requesterEmail: string; reason: string; evidenceNote: string; status: string; createdAt: string };
const APPEAL_STATUS: Record<string, string> = { PENDING: "대기", UNDER_REVIEW: "검토 중", ACCEPTED: "수용", REJECTED: "기각" };

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
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [appealTarget, setAppealTarget] = useState<Appeal | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAppeals = () => fetch("/api/appeals").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setAppeals(d); });

  useEffect(() => {
    fetch("/api/admin/console-summary").then((r) => r.json()).then(setS).catch(() => {});
    loadAppeals();
  }, []);

  const resolveAppeal = async (result: "ACCEPTED" | "REJECTED") => {
    if (!appealTarget) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${appealTarget.projectId}/appeal`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appealId: appealTarget.id, result, reviewNote }) });
    setSaving(false);
    if (res.ok) { setAppealTarget(null); setReviewNote(""); loadAppeals(); }
    else alert((await res.json()).error ?? "처리에 실패했습니다");
  };
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
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="space-y-1 p-4">
            {s.exceptions.map((e, i) => (
              <Link key={i} href={e.link} className="flex items-center gap-2 text-sm text-red-700 hover:underline">
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
            <p className="mt-0.5 text-sm text-muted-foreground">이번 달 G3 AI 활용 {s.cards.governance.g3ThisMonth}건</p>
          </CardContent></Card>
        </Link>

        <Link href="/dashboard">
          <Card className="h-full transition-colors hover:bg-accent/40"><CardContent className="p-4">
            <p className="text-xs font-semibold text-primary">② PI 지원</p>
            <p className="mt-2 text-sm">개선 진행 <b>{s.cards.pi.activeDepartments}</b>개 부서 · AI 활용 {s.cards.pi.activeProjects}건</p>
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

      {/* 이의제기 위젯 */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">
            처리 대기 이의제기 {appeals.length}건
          </p>
          {appeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">처리 대기 중인 이의제기가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {appeals.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2 py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.projectTitle ?? a.projectId}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.requesterEmail}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 border-l-2 border-muted pl-2">{a.reason}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{APPEAL_STATUS[a.status] ?? a.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => { setAppealTarget(a); setReviewNote(""); }}>처리</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 이의제기 처리 다이얼로그 */}
      <Dialog open={!!appealTarget} onOpenChange={(v) => !v && setAppealTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이의제기 처리 — {appealTarget?.projectTitle ?? appealTarget?.projectId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">이의 사유</p>
              <p>{appealTarget?.reason}</p>
              {appealTarget?.evidenceNote && <p className="mt-1 text-xs">근거: {appealTarget.evidenceNote}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>검토 의견</Label>
              <Textarea rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="처리 결과 및 사유를 입력하세요 (신청자에게 전달됩니다)" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAppealTarget(null)}>취소</Button>
              <Button variant="destructive" disabled={saving} onClick={() => resolveAppeal("REJECTED")}>기각</Button>
              <Button disabled={saving} onClick={() => resolveAppeal("ACCEPTED")}>수용</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
