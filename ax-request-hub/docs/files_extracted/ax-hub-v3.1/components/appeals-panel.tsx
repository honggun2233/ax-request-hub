"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";

type Appeal = {
  id: string; projectId: string; projectTitle?: string;
  requesterEmail: string; reason: string; evidenceNote?: string;
  status: "PENDING" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED"; createdAt: string;
};

/** AX팀 — /dashboard 이의제기 탭. 대기 목록은 /api/appeals (별첨 라우트) 사용 */
export function AppealsPanel() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const res = await fetch("/api/appeals");
    if (res.ok) setAppeals(await res.json());
  };
  useEffect(() => { load(); }, []);

  const resolve = async (a: Appeal, result: "ACCEPTED" | "REJECTED") => {
    const res = await fetch(`/api/projects/${a.projectId}/appeal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appealId: a.id, result, reviewNote: notes[a.id] ?? "" }),
    });
    if (res.ok) load();
    else alert((await res.json()).error ?? "처리에 실패했습니다");
  };

  return (
    <div className="space-y-3">
      {appeals.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">처리 대기 중인 이의제기가 없습니다</p>
      )}
      {appeals.map((a) => (
        <Card key={a.id}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="truncate">{a.projectTitle ?? a.projectId}</span>
              <StatusBadge label="처리 대기" tone="warning" />
            </CardTitle>
            <p className="text-xs text-muted-foreground">{a.requesterEmail} · {new Date(a.createdAt).toLocaleDateString("ko-KR")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{a.reason}</p>
            {a.evidenceNote && <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{a.evidenceNote}</p>}
            <Textarea
              placeholder="검토 의견 (신청자에게 알림으로 전달됩니다)"
              value={notes[a.id] ?? ""}
              onChange={(e) => setNotes((p) => ({ ...p, [a.id]: e.target.value }))}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => resolve(a, "REJECTED")}>기각</Button>
              <Button size="sm" onClick={() => resolve(a, "ACCEPTED")}>수용 — 재검토 진행</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
