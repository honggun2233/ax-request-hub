"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

type Row = {
  id: string; title: string; department: string;
  expectedValue: number | null; unit: string | null; unitLabel: string | null;
  records: { period: string; value: number; note: string }[];
  realizedTotal: number; realizedPct: number | null;
};

function currentQuarter() {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export default function BenefitsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [target, setTarget] = useState<Row | null>(null);
  const [period, setPeriod] = useState(currentQuarter());
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  const load = () => fetch("/api/admin/benefits").then((r) => r.json()).then(setRows);
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!target) return;
    const res = await fetch("/api/admin/benefits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: target.id, period,
        realizedValue: Number(value),
        unit: target.unit ?? "HOURS_YEAR",
        note,
      }),
    });
    if (res.ok) { setTarget(null); setValue(""); setNote(""); load(); }
    else alert((await res.json()).error ?? "기록에 실패했습니다");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">PI 효과 실현</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          상용 전환된 AI 활용의 신청 시 예상 효과 대비 분기별 실현치를 기록합니다. 경영 보고의 근거 자료가 됩니다.
        </p>
      </div>

      {rows.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          상용 전환된 AI 활용이 아직 없습니다. AI 위원회 승인 후 이 목록에 나타납니다.
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.department}</p>
              </div>
              <div className="flex items-center gap-5 text-sm">
                <span className="text-muted-foreground">
                  예상 {r.expectedValue !== null ? `${r.expectedValue.toLocaleString()} ${r.unitLabel ?? ""}` : "미입력"}
                </span>
                <span>
                  누적 실현 <b>{r.realizedTotal.toLocaleString()}</b>
                  {r.realizedPct !== null && <span className="ml-1 text-muted-foreground">({r.realizedPct}%)</span>}
                </span>
                <span className="text-xs text-muted-foreground">{r.records.map((x) => x.period).join(" · ") || "기록 없음"}</span>
                <Button size="sm" variant="outline" onClick={() => setTarget(r)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />분기 기록
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>실현 효과 기록 — {target?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>분기</Label>
                <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-Q3" />
              </div>
              <div className="space-y-1.5">
                <Label>실현치 {target?.unitLabel ? `(${target.unitLabel})` : ""}</Label>
                <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>산출 근거</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="예: 월 처리 420건 × 건당 12분 절감 → 분기 252시간" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTarget(null)}>취소</Button>
              <Button onClick={save} disabled={!value || !/^\d{4}-Q[1-4]$/.test(period)}>기록</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
