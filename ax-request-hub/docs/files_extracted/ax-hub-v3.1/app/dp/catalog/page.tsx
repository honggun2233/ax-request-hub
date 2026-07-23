"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

type Asset = {
  id?: string; name: string; description: string; ownerDept: string;
  classification: "G1" | "G2" | "G3"; deliveryModes: string; updateCycle?: string; isActive: boolean;
};

const EMPTY: Asset = { name: "", description: "", ownerDept: "", classification: "G2", deliveryModes: "API", updateCycle: "", isActive: true };
const MODES = ["API", "FILE", "DB"];
const G_TONE = { G1: "default", G2: "info", G3: "danger" } as const;

/** 데이터플랫폼팀 — 카탈로그 등록·수정 (기존 /api/data/assets API 사용) */
export default function DpCatalogPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    const res = await fetch("/api/data/assets");
    if (res.ok) setAssets(await res.json());
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    const isNew = !editing.id;
    const res = await fetch(isNew ? "/api/data/assets" : `/api/data/assets/${editing.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    if (res.ok) { setEditing(null); load(); }
    else alert((await res.json()).error ?? "저장에 실패했습니다");
  };

  const filtered = assets.filter((a) =>
    !q || a.name.includes(q) || a.ownerDept.includes(q) || a.description.includes(q));

  const setF = (patch: Partial<Asset>) => setEditing((p) => (p ? { ...p, ...patch } : p));
  const toggleMode = (m: string) => {
    if (!editing) return;
    const set = new Set(editing.deliveryModes.split(",").filter(Boolean));
    set.has(m) ? set.delete(m) : set.add(m);
    setF({ deliveryModes: Array.from(set).join(",") });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">카탈로그 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            직원이 검색하는 데이터 자산 목록입니다. 기밀등급은 제공 승인 절차를 결정합니다.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}><Plus className="mr-1.5 h-4 w-4" />자산 등록</Button>
      </div>

      <Input placeholder="이름, 부서, 설명으로 검색" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      <div className="space-y-2">
        {filtered.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{a.name}</p>
                  <StatusBadge label={a.classification} tone={G_TONE[a.classification]} />
                  {!a.isActive && <StatusBadge label="비활성" tone="default" />}
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {a.ownerDept} · {a.deliveryModes.replaceAll(",", " · ")}{a.updateCycle ? ` · ${a.updateCycle}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditing(a)} aria-label="수정">
                <Pencil className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {q ? "검색 결과가 없습니다" : "등록된 자산이 없습니다. 첫 자산을 등록하세요."}
          </p>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "자산 수정" : "자산 등록"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>자산명</Label>
                <Input value={editing.name} onChange={(e) => setF({ name: e.target.value })} placeholder="ETF 일별 기준가" />
              </div>
              <div className="space-y-1.5">
                <Label>설명</Label>
                <Textarea rows={2} value={editing.description} onChange={(e) => setF({ description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>소유 부서</Label>
                  <Input value={editing.ownerDept} onChange={(e) => setF({ ownerDept: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>기밀등급</Label>
                  <Select value={editing.classification} onValueChange={(v) => setF({ classification: v as Asset["classification"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="G1">G1 — 공개</SelectItem>
                      <SelectItem value="G2">G2 — 내부</SelectItem>
                      <SelectItem value="G3">G3 — 기밀 (정보보호 협의 필수)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>제공 방식</Label>
                  <div className="flex gap-4 pt-1.5">
                    {MODES.map((m) => (
                      <label key={m} className="flex items-center gap-1.5 text-sm">
                        <Checkbox checked={editing.deliveryModes.split(",").includes(m)} onCheckedChange={() => toggleMode(m)} />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>갱신 주기</Label>
                  <Input value={editing.updateCycle ?? ""} onChange={(e) => setF({ updateCycle: e.target.value })} placeholder="일배치" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={editing.isActive} onCheckedChange={(v) => setF({ isActive: Boolean(v) })} />
                카탈로그에 노출 (비활성 시 직원 검색에서 숨김)
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>취소</Button>
                <Button onClick={save} disabled={!editing.name || !editing.ownerDept || !editing.deliveryModes}>저장</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
