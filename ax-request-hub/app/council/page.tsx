"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Gavel, AlertTriangle } from "lucide-react";

type Meeting = { id: string; meetingNo: number; heldAt: string; notes?: string; _count: { items: number } };
type PendingItem = {
  id: string;
  itemType: string;
  packageMeta: string;
  project?: { id: string; title: string; requesterName: string; confidentialityLevel: string } | null;
  createdAt?: string;
};

/**
 * AI 위원회 기록 (ADMIN 전용).
 * AI 위원회는 오프라인으로 진행되며, 이 화면은 AX팀 간사가
 * 회의 전 안건을 편성하고 회의 후 의결 결과를 기록하는 도구다.
 */
export default function CouncilPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [open, setOpen] = useState(false);
  const [heldAt, setHeldAt] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    const [meetRes, agendaRes] = await Promise.all([
      fetch("/api/council/meetings"),
      fetch("/api/council/agenda"),
    ]);
    if (meetRes.ok) setMeetings(await meetRes.json());
    if (agendaRes.ok) {
      const items: PendingItem[] = await agendaRes.json();
      setPendingItems(items.filter((i) => i.itemType === "HIGH_RISK_REJECTION" && !("meetingId" in i && (i as any).meetingId)));
    }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const res = await fetch("/api/council/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heldAt, notes }),
    });
    if (res.ok) { setOpen(false); setHeldAt(""); setNotes(""); load(); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">AI 위원회 기록</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI 위원회는 오프라인으로 진행됩니다. 회의 전 안건을 편성하고, 회의 후 의결 결과를 여기에 기록하세요.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" />회의 등록</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>AI 위원회 등록</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="heldAt">개최일</Label>
                <Input id="heldAt" type="date" value={heldAt} onChange={(e) => setHeldAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">회의 요록 (선택 — 회의 후 입력 가능)</Label>
                <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="참석자, 주요 논의 사항" />
              </div>
              <div className="flex justify-end">
                <Button onClick={create} disabled={!heldAt}>등록</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 고위험 검토 대기 안건 */}
      {pendingItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            검토 대기 — CONFIDENTIAL / 고위험 안건 ({pendingItems.length}건)
          </div>
          {pendingItems.map((item) => {
            const meta = (() => { try { return JSON.parse(item.packageMeta); } catch { return {}; } })();
            return (
              <Card key={item.id} className="border-destructive/40 bg-destructive/5">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm">
                        {item.project?.title ?? meta.agentName ?? "제목 없음"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        신청자: {item.project?.requesterName ?? meta.requesterEmail ?? "—"}
                        {meta.reason ? ` · 사유: ${meta.reason}` : ""}
                      </p>
                      {meta.receivedAt && (
                        <p className="text-xs text-muted-foreground">
                          접수: {new Date(meta.receivedAt).toLocaleString("ko-KR")}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive font-medium">
                      미배정
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {meetings.length === 0 && pendingItems.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          등록된 회의가 없습니다. 첫 회의를 등록하세요.
        </CardContent></Card>
      )}
      {meetings.length === 0 && pendingItems.length > 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          등록된 회의가 없습니다. 위 안건을 회의에 배정하려면 회의를 먼저 등록하세요.
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {meetings.map((m) => (
          <Link key={m.id} href={`/council/${m.id}`}
            className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50">
            <div className="flex items-center gap-3">
              <Gavel className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">제{m.meetingNo}차 AI 위원회</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(m.heldAt).toLocaleDateString("ko-KR")} · 안건 {m._count.items}건
                </p>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">안건 관리 →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
