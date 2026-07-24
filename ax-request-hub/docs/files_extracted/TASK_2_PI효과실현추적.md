# 작업지시서 2: PI 효과 실현 추적 (스키마 + 기록 화면)

> Claude Code 실행용. 작업지시서 1과 독립적으로 수행 가능하나, 1 이후 수행 시
> 콘솔 PI 카드의 "효과 실현 —"이 자동으로 %로 바뀐다.
> 대상 레포: ax-request-hub

## 배경 (왜 하는가)

과제 신청 시 예상 효과(expectedBenefit 텍스트, ROI 점수)는 기록되지만 **실현 여부는 아무도 추적하지 않는다.**
PI 지원 업무의 성과 근거는 "예상 대비 실현"이므로 이 데이터 고리를 만든다.

관리 철학 (작업지시서 1과 동일):
- 달성률은 **부서·개인 평가 지표가 아니다** — 경영 보고용 PI 성과 스토리의 근거 수치다.
  화면 문구·색상에서 평가 뉘앙스(저조/미달/경고)를 쓰지 않는다.
- 기록 주기는 분기 1회 — 관리 부담을 최소화한다.

## 작업 범위

- [ ] 1. 스키마: §스키마 대로 Project에 2필드 + BenefitRecord 모델 추가
      → `npx prisma migrate dev --name v3_2_benefit_tracking`
- [ ] 2. `app/api/admin/benefits/route.ts` 신규 (§코드 C)
- [ ] 3. `app/admin/benefits/page.tsx` 신규 (§코드 D)
- [ ] 4. 사이드바 "과제 운영" 그룹에
      `{ href: "/admin/benefits", label: "PI 효과 실현", icon: TrendingUp }` 추가
- [ ] 5. `/submit` 신청 폼에 선택 입력 2개 추가 (§신청 폼 변경)
- [ ] 6. `npx tsc --noEmit` · `npm run build` · §수용 기준 확인

## §신청 폼 변경 (`app/submit/` 및 POST /api/projects)

기존 expectedBenefit 텍스트 필드는 그대로 두고, 그 아래 **선택(optional)** 입력 2개를 추가한다:
- `expectedBenefitValue` (number) — 라벨: "정량 예상 효과 (선택)"
- `expectedBenefitUnit` (select) — "시간/년"(HOURS_YEAR) | "만원/년"(KRW_10K_YEAR)
- 도움말 문구: "정식 운영 전환 후 실현 효과와 비교하는 데 사용됩니다. 대략적인 추정이면 충분합니다."
- POST /api/projects 핸들러에서 두 값을 저장 (미입력 허용, 검증: value ≥ 0)
- **평가 로직(6차원 스코어링)에는 반영하지 않는다** — 입력 부담이 점수 손해로 이어지면 안 된다.

## §스키마

```prisma
// ─── PI 효과 실현 추적 (v3.2) ───
// Project에 정량 예상 효과 2필드 추가 (기존 expectedBenefit 텍스트는 유지):
//
// model Project {
//   ...기존 필드...
//   expectedBenefitValue Float?   // 정량 예상 효과 (연간 환산)
//   expectedBenefitUnit  String?  // "HOURS_YEAR"(시간/년) | "KRW_10K_YEAR"(만원/년)
//   benefitRecords       BenefitRecord[]
// }

model BenefitRecord {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id])
  agentId       String?  // 연관 상용 에이전트 (선택)
  period        String   // "2026-Q3" — 분기 기록
  realizedValue Float    // 해당 분기 실현 효과 (연간 환산 아님, 분기 실측)
  unit          String   // Project.expectedBenefitUnit과 동일 단위
  note          String   @default("")   // 산출 근거 (예: 처리건수 x 건당 절감시간)
  recordedBy    String   // 기록자 이메일
  createdAt     DateTime @default(now())

  @@unique([projectId, period])
}
```

## 코드 C — `app/api/admin/benefits/route.ts` (신규)

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

const UNIT_LABEL: Record<string, string> = { HOURS_YEAR: "시간/년", KRW_10K_YEAR: "만원/년" };

/** 상용 전환 과제의 예상 vs 실현 효과 목록 */
export async function GET() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const prodAgents = await prisma.agentRegistry.findMany({
    where: { phase: "PRODUCTION", projectId: { not: null } },
    select: { projectId: true, prodStatus: true },
  });
  const projectIds = [...new Set(prodAgents.map((a) => a.projectId!))];
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    include: { benefitRecords: { orderBy: { period: "asc" } } },
  });

  return NextResponse.json(
    projects.map((p) => {
      const realizedTotal = p.benefitRecords.reduce((s, r) => s + r.realizedValue, 0);
      const expected = (p as any).expectedBenefitValue as number | null;
      return {
        id: p.id,
        title: p.title,
        department: p.department,
        expectedValue: expected,
        unit: (p as any).expectedBenefitUnit ?? p.benefitRecords[0]?.unit ?? null,
        unitLabel: UNIT_LABEL[(p as any).expectedBenefitUnit ?? ""] ?? null,
        records: p.benefitRecords.map((r) => ({ period: r.period, value: r.realizedValue, note: r.note })),
        realizedTotal,
        // 달성률은 참고치 — 예상(연간) 대비 누적 실현. 평가 지표가 아니라 PI 성과 스토리용
        realizedPct: expected ? Math.round((realizedTotal / expected) * 100) : null,
      };
    })
  );
}

/** 분기 실현치 기록 — 같은 분기 재기록 시 갱신 */
export async function POST(req: Request) {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;
  const { projectId, period, realizedValue, unit, note } = await req.json();
  if (!projectId || !period || realizedValue === undefined || !unit)
    return NextResponse.json({ error: "projectId, period, realizedValue, unit은 필수입니다" }, { status: 400 });
  if (!/^\d{4}-Q[1-4]$/.test(period))
    return NextResponse.json({ error: "period는 '2026-Q3' 형식입니다" }, { status: 400 });

  const rec = await prisma.benefitRecord.upsert({
    where: { projectId_period: { projectId, period } },
    update: { realizedValue, unit, note: note ?? "", recordedBy: auth.user.email },
    create: { projectId, period, realizedValue, unit, note: note ?? "", recordedBy: auth.user.email },
  });
  await prisma.auditLog.create({
    data: {
      entityType: "Project", entityId: projectId, action: "BENEFIT_RECORDED",
      actorEmail: auth.user.email, detail: JSON.stringify({ period, realizedValue, unit }),
    },
  });
  return NextResponse.json(rec, { status: 201 });
}
```

## 코드 D — `app/admin/benefits/page.tsx` (신규)

```tsx
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

/**
 * PI 효과 실현 기록 — 상용 전환 과제의 "예상 vs 실현".
 * 달성률은 부서 평가용이 아니라 PI 성과 스토리(경영 보고)용 참고치다.
 */
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
          상용 전환 과제의 신청 시 예상 효과 대비 분기별 실현치를 기록합니다. 경영 보고의 근거 자료가 됩니다.
        </p>
      </div>

      {rows.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          상용 전환된 과제가 아직 없습니다. 협의회 승인 후 이 목록에 나타납니다.
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
```

## 수용 기준

1. 마이그레이션 후 기존 데이터·화면에 회귀 없음 (신규 필드 전부 nullable/선택).
2. 상용 전환(phase=PRODUCTION) 과제만 /admin/benefits 목록에 나타난다.
3. 같은 분기 재기록 시 오류 없이 갱신(upsert)되고 AuditLog에 BENEFIT_RECORDED가 남는다.
4. 신청 폼에서 정량 효과를 비워도 신청이 정상 진행되고, 점수에 영향이 없다.
5. (작업지시서 1 적용 시) 콘솔 PI 카드가 "— (집계 준비 중)" 대신 %를 표시한다.
6. period 형식 오류("2026-3분기" 등) → 400과 한국어 안내.

## 운영 규칙 반영 (코드 외 — 완료 보고에 포함만)

다음을 거버넌스 문서에 반영해야 함을 완료 보고에 명시하라 (문서 수정은 이 작업 범위 아님):
- AX-POLICY 협의회 조항: 상용 전환 승인 시 "효과 실현 지표·분기 기록 책임자"를 운영 계획에 포함
- AX-MANUAL: 신청서 정량 예상 효과 입력 안내 (선택 사항이며 평가 점수와 무관함을 명시)

## 완료 보고 형식

- 마이그레이션 결과 · 변경/신규 파일 목록 · tsc/빌드 결과 · 수용 기준 6건 결과
