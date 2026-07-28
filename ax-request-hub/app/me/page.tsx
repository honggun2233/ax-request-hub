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

export default function MePage() {
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/summary")
      .then(async (r) => {
        if (r.ok) return r.json();
        const text = await r.text().catch(() => r.status.toString());
        throw new Error(`${r.status}: ${text.slice(0, 200)}`);
      })
      .then(setS)
      .catch((e) => setError(e.message ?? "알 수 없는 오류"));
  }, []);

  if (error) return (
    <div className="p-6 space-y-2">
      <p className="text-sm font-medium text-red-600">내 정보 API 오류 — 새로고침해 주세요.</p>
      <pre className="text-xs text-muted-foreground bg-muted p-3 rounded overflow-auto">{error}</pre>
    </div>
  );
  if (!s) return <p className="p-6 text-sm text-muted-foreground">불러오는 중…</p>;

  const initials = s.profile.name.slice(-2);

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
              {s.literacy.nextCourse && <span className="text-muted-foreground"> — &apos;{s.literacy.nextCourse}&apos; 남음</span>}
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
