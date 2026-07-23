"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Check, X, Plus } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { AGENDA_TYPE_LABELS, COUNCIL_DECISION_LABELS } from "@/lib/lifecycle-labels";

type Check5 = { key: string; label: string; passed: boolean; detail?: string };
type Candidate = { agent: { id: string; name: string; agentName?: string }; eligible: boolean; checks: Check5[] };
type Item = {
  id: string; itemType: string; decision?: string; decisionNote?: string;
  conditions?: string; agent: { id: string; name: string; agentName?: string };
};
type Meeting = { id: string; meetingNo: number; heldAt: string; notes?: string; items: Item[] };

export default function CouncilMeetingPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selAgent, setSelAgent] = useState("");
  const [selType, setSelType] = useState("PROD_APPROVAL");
  const [decideTarget, setDecideTarget] = useState<Item | null>(null);
  const [decision, setDecision] = useState("APPROVED");
  const [note, setNote] = useState("");
  const [condText, setCondText] = useState("");

  const load = useCallback(async () => {
    const [m, c] = await Promise.all([
      fetch(`/api/council/meetings/${meetingId}`).then((r) => r.json()),
      fetch("/api/council/agenda?mode=eligible").then((r) => r.json()),
    ]);
    setMeeting(m); setCandidates(c);
  }, [meetingId]);
  useEffect(() => { load(); }, [load]);

  const addItem = async () => {
    const res = await fetch("/api/council/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, agentId: selAgent, itemType: selType }),
    });
    if (res.ok) { setSelAgent(""); load(); }
    else alert((await res.json()).error ?? "상정에 실패했습니다");
  };

  const submitDecision = async () => {
    if (!decideTarget) return;
    const body: Record<string, unknown> = { decision, decisionNote: note };
    if (decision === "CONDITIONAL")
      body.conditions = condText.split("\n").map((s) => s.trim()).filter(Boolean);
    const res = await fetch(`/api/council/agenda/${decideTarget.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { setDecideTarget(null); setNote(""); setCondText(""); load(); }
    else alert((await res.json()).error ?? "의결 입력에 실패했습니다");
  };

  const toggleCondition = async (item: Item, index: number, done: boolean) => {
    await fetch(`/api/council/agenda/${item.id}/conditions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index, done }),
    });
    load();
  };

  if (!meeting) return <div className="p-6 text-sm text-muted-foreground">불러오는 중…</div>;

  const selCandidate = candidates.find((c) => c.agent.id === selAgent);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">제{meeting.meetingNo}차 협의회</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          개최일 {new Date(meeting.heldAt).toLocaleDateString("ko-KR")} — 오프라인 회의 결과를 기록하면 시스템 상태가 자동 전환됩니다.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">안건 상정</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Select value={selType} onValueChange={setSelType}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(AGENDA_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selAgent} onValueChange={setSelAgent}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="에이전트 선택" /></SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.agent.id} value={c.agent.id}>
                    {c.agent.name ?? c.agent.agentName}{c.eligible ? "" : " (요건 미충족)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addItem} disabled={!selAgent || (selType === "PROD_APPROVAL" && !selCandidate?.eligible)}>
              <Plus className="mr-1 h-4 w-4" />상정
            </Button>
          </div>
          {selType === "PROD_APPROVAL" && selCandidate && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">상정 요건 검증 (5종)</p>
              <ul className="space-y-1">
                {selCandidate.checks.map((ck) => (
                  <li key={ck.key} className="flex items-center gap-2 text-sm">
                    {ck.passed
                      ? <Check className="h-4 w-4 text-green-600" />
                      : <X className="h-4 w-4 text-red-500" />}
                    {ck.label}
                    {ck.detail && <span className="text-xs text-muted-foreground">({ck.detail})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-sm font-medium">안건 목록 ({meeting.items.length}건)</p>
        {meeting.items.map((item, idx) => {
          const conds: { condition: string; done: boolean }[] = item.conditions ? JSON.parse(item.conditions) : [];
          return (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      <span className="mr-2 text-muted-foreground">#{idx + 1}</span>
                      {item.agent.name ?? item.agent.agentName}
                    </p>
                    <p className="text-sm text-muted-foreground">{AGENDA_TYPE_LABELS[item.itemType] ?? item.itemType}</p>
                  </div>
                  {item.decision ? (
                    <StatusBadge
                      label={COUNCIL_DECISION_LABELS[item.decision] ?? item.decision}
                      tone={item.decision === "APPROVED" ? "success" : item.decision === "CONDITIONAL" ? "warning" : item.decision === "DEFERRED" ? "default" : "danger"}
                    />
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setDecideTarget(item)}>의결 입력</Button>
                  )}
                </div>
                {item.decisionNote && <p className="text-sm text-muted-foreground">사유: {item.decisionNote}</p>}
                {conds.length > 0 && (
                  <div className="rounded-md border p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      조건 이행 ({conds.filter((c) => c.done).length}/{conds.length}) — 전건 이행 시 정식 운영 전환
                    </p>
                    {conds.map((c, i) => (
                      <label key={i} className="flex items-center gap-2 py-0.5 text-sm">
                        <Checkbox checked={c.done} onCheckedChange={(v) => toggleCondition(item, i, Boolean(v))} />
                        <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.condition}</span>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!decideTarget} onOpenChange={(v) => !v && setDecideTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>의결 결과 입력 — {decideTarget ? (decideTarget.agent.name ?? decideTarget.agent.agentName) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>의결</Label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COUNCIL_DECISION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {decision === "CONDITIONAL" && (
              <div className="space-y-1.5">
                <Label>조건 (줄바꿈으로 구분)</Label>
                <Textarea rows={3} value={condText} onChange={(e) => setCondText(e.target.value)}
                  placeholder={"운영 담당자 2인 지정\n장애 대응 절차 문서화"} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{["REMANDED", "REJECTED"].includes(decision) ? "사유 (필수 — 신청자에게 전달)" : "의견 (선택)"}</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDecideTarget(null)}>취소</Button>
              <Button onClick={submitDecision}
                disabled={["REMANDED", "REJECTED"].includes(decision) && !note.trim()}>
                기록 — 상태 전환 실행
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
