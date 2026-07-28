"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Appeal = {
  id: string;
  projectId: string;
  projectTitle?: string;
  requesterEmail: string;
  reason: string;
  evidenceNote: string;
  status: string;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  UNDER_REVIEW: "검토 중",
  ACCEPTED: "수용",
  REJECTED: "기각",
};

export default function AppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [target, setTarget] = useState<Appeal | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch("/api/appeals").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setAppeals(data);
    });

  useEffect(() => { load(); }, []);

  const resolve = async (result: "ACCEPTED" | "REJECTED") => {
    if (!target) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${target.projectId}/appeal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appealId: target.id, result, reviewNote }),
    });
    setSaving(false);
    if (res.ok) { setTarget(null); setReviewNote(""); load(); }
    else alert((await res.json()).error ?? "처리에 실패했습니다");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">이의제기 처리</h1>
        <p className="mt-1 text-sm text-muted-foreground">대기 중인 이의제기를 검토하고 처리합니다.</p>
      </div>

      {appeals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            처리 대기 중인 이의제기가 없습니다.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {appeals.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{a.projectTitle ?? a.projectId}</p>
                  <p className="text-xs text-muted-foreground">{a.requesterEmail}</p>
                </div>
                <Badge variant="outline">{STATUS_LABEL[a.status] ?? a.status}</Badge>
              </div>
              <p className="text-sm border-l-2 border-muted pl-3 text-muted-foreground">{a.reason}</p>
              {a.evidenceNote && (
                <p className="text-xs text-muted-foreground">근거: {a.evidenceNote}</p>
              )}
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => { setTarget(a); setReviewNote(""); }}>
                  처리
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이의제기 처리 — {target?.projectTitle ?? target?.projectId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">이의 사유</p>
              <p>{target?.reason}</p>
              {target?.evidenceNote && <p className="mt-1 text-xs">근거: {target.evidenceNote}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>검토 의견</Label>
              <Textarea
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="처리 결과 및 사유를 입력하세요 (신청자에게 전달됩니다)"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTarget(null)}>취소</Button>
              <Button variant="destructive" disabled={saving} onClick={() => resolve("REJECTED")}>기각</Button>
              <Button disabled={saving} onClick={() => resolve("ACCEPTED")}>수용</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
