import { prisma } from "@/lib/prisma";
import { checkProdEligibility, displayName } from "@/lib/council-eligibility";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Check, X, ArrowLeft, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AGENDA_TYPE_LABELS, COUNCIL_DECISION_LABELS } from "@/lib/lifecycle-labels";

const DECISION_CLS: Record<string, string> = {
  APPROVED:    "text-green-700 bg-green-50 border-green-300",
  CONDITIONAL: "text-amber-700 bg-amber-50 border-amber-300",
  DEFERRED:    "text-slate-600 bg-slate-50 border-slate-300",
  REMANDED:    "text-orange-700 bg-orange-50 border-orange-300",
  REJECTED:    "text-red-700 bg-red-50 border-red-300",
};

/**
 * /council/[meetingId]/agenda/[itemId]
 * 협의회 심의 패키지 상세 — AX팀 전용 (서버 컴포넌트).
 * API: GET /api/council/agenda/[id] 를 DB 직접 호출로 대체 (서버-사이드 렌더).
 */
export default async function AgendaDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string; itemId: string }>;
}) {
  const { meetingId, itemId } = await params;

  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "AX_TEAM") redirect("/login");

  const item = await prisma.councilAgendaItem.findUnique({
    where: { id: itemId },
    include: {
      meeting: true,
      agent: {
        include: {
          scores: {
            where: { phase: "DEVELOPMENT", month: { not: null } },
            orderBy: { month: "asc" },
          },
        },
      },
    },
  });

  if (!item || item.meetingId !== meetingId) notFound();

  const { eligible, checks } = await checkProdEligibility(item.agentId);

  let parsedConditions: { condition: string; done: boolean; checkedBy: string | null }[] | null = null;
  if (item.conditions) {
    try { parsedConditions = JSON.parse(item.conditions); } catch { /* ignore */ }
  }

  let packageMeta: Record<string, unknown> | null = null;
  if (item.packageMeta) {
    try { packageMeta = JSON.parse(item.packageMeta); } catch { /* ignore */ }
  }

  const agent = item.agent;
  const agentName = displayName(agent);
  const decisionCls = item.decision ? (DECISION_CLS[item.decision] ?? DECISION_CLS.DEFERRED) : "";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/council/${meetingId}`}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          제{item.meeting.meetingNo}차 협의회
        </Link>
        <span>/</span>
        <span className="text-foreground">{agentName}</span>
      </div>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">{agentName}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {AGENDA_TYPE_LABELS[item.itemType] ?? item.itemType}
            {" · "}협의회 제{item.meeting.meetingNo}차
            {" · "}{new Date(item.meeting.heldAt).toLocaleDateString("ko-KR")}
          </p>
        </div>
        <div>
          {item.decision ? (
            <span className={`text-sm font-semibold px-3 py-1.5 rounded border ${decisionCls}`}>
              {COUNCIL_DECISION_LABELS[item.decision] ?? item.decision}
            </span>
          ) : (
            <span className="text-sm font-medium px-3 py-1.5 rounded border text-amber-700 bg-amber-50 border-amber-300">
              심의 대기
            </span>
          )}
        </div>
      </div>

      {/* 상정 요건 5종 */}
      {item.itemType === "PROD_APPROVAL" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              상정 요건 5종
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded border ${
                  eligible
                    ? "text-green-700 bg-green-50 border-green-300"
                    : "text-amber-700 bg-amber-50 border-amber-300"
                }`}
              >
                {eligible ? "전건 충족" : "미충족 있음"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {checks.map((ck) => (
                <li key={ck.key} className="flex items-center gap-3 text-sm">
                  {ck.passed ? (
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span className={ck.passed ? "" : "text-muted-foreground"}>{ck.label}</span>
                  {ck.detail && (
                    <span className="text-xs text-muted-foreground">({ck.detail})</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 에이전트 정보 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">에이전트 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs mb-0.5">에이전트명</dt>
              <dd className="font-medium">{agentName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs mb-0.5">담당자(Owner)</dt>
              <dd>{agent.owner ?? "-"}</dd>
            </div>
            {agent.purpose && (
              <div>
                <dt className="text-muted-foreground text-xs mb-0.5">목적</dt>
                <dd className="text-muted-foreground text-xs">{agent.purpose}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground text-xs mb-0.5">Gate 통과 여부</dt>
              <dd className="flex gap-1.5">
                {(
                  [
                    ["G1", agent.gate1Passed],
                    ["G2", agent.gate2Passed],
                    ["G3", agent.gate3Passed],
                  ] as [string, boolean][]
                ).map(([label, passed]) => (
                  <span
                    key={label}
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      passed ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </dd>
            </div>
            {agent.sam30dAccuracy != null && (
              <div>
                <dt className="text-muted-foreground text-xs mb-0.5">30일 정확도</dt>
                <dd>{(agent.sam30dAccuracy * 100).toFixed(1)}%</dd>
              </div>
            )}
            {agent.fallbackRate != null && (
              <div>
                <dt className="text-muted-foreground text-xs mb-0.5">Fallback율</dt>
                <dd>{(agent.fallbackRate * 100).toFixed(1)}%</dd>
              </div>
            )}
            {agent.prodKpiTarget && (
              <div className="col-span-2">
                <dt className="text-muted-foreground text-xs mb-0.5">상용 KPI 목표</dt>
                <dd className="font-mono text-xs bg-muted rounded px-2 py-1">{agent.prodKpiTarget}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* 파일럿 KPI 실적 */}
      {agent.scores.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              파일럿 KPI 실적 ({agent.scores.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-1.5 pr-6 text-left font-medium">월</th>
                  <th className="py-1.5 pr-6 text-right font-medium">달성률</th>
                  <th className="py-1.5 text-left font-medium">비고</th>
                </tr>
              </thead>
              <tbody>
                {agent.scores.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-6">{s.month}</td>
                    <td
                      className={`py-1.5 pr-6 text-right font-medium ${
                        (s.achieveRate ?? 0) >= 60 ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {s.achieveRate ?? "-"}%
                    </td>
                    <td className="py-1.5 text-muted-foreground text-xs">
                      {s.rationale ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 조건부 승인 조건 */}
      {parsedConditions && parsedConditions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              조건부 승인 이행 현황 (
              {parsedConditions.filter((c) => c.done).length}/{parsedConditions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {parsedConditions.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {c.done ? (
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <span className={c.done ? "line-through text-muted-foreground" : ""}>{c.condition}</span>
                    {c.checkedBy && (
                      <span className="ml-2 text-xs text-muted-foreground">({c.checkedBy})</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 심의 패키지 스냅샷 */}
      {packageMeta && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">심의 패키지 스냅샷</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-muted-foreground bg-muted rounded p-3 overflow-auto max-h-60 whitespace-pre-wrap">
              {JSON.stringify(packageMeta, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* 의결 의견 */}
      {item.decisionNote && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">의결 의견</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{item.decisionNote}</p>
            {item.decidedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(item.decidedAt).toLocaleDateString("ko-KR")} 기록
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 하단 액션 */}
      <div className="flex justify-end">
        <Link
          href={`/council/${meetingId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 회의 목록으로
        </Link>
      </div>
    </div>
  );
}
