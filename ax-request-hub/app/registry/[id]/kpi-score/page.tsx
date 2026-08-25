"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface KpiScore {
  id: string;
  month: string;
  achieveRate: number;
  kpiActual: number | null;
  rationale: string | null;
  phase: string;
  createdAt: string;
}

interface AgentInfo {
  id: string;
  agentName: string;
  phase: string;
  prodStatus: string | null;
  retireFlag: boolean;
  retireFlagReason: string | null;
  retireFlagMonths: string[];
  pilotKpiTarget: string | null;
  prodKpiTarget: string | null;
  scores: KpiScore[];
}

export default function KpiScorePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 입력 폼
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [achieveRate, setAchieveRate] = useState("");
  const [kpiActual, setKpiActual] = useState("");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [infoRes, scoresRes] = await Promise.all([
        fetch(`/api/registry/${id}`),
        fetch(`/api/registry/${id}/kpi-score`),
      ]);
      const info = await infoRes.json();
      const scoresData = await scoresRes.json();
      if (infoRes.ok) {
        setAgent({
          ...info,
          scores: Array.isArray(scoresData) ? scoresData : [],
        });
      } else {
        setError(info.error ?? "에이전트 정보를 불러올 수 없습니다");
      }
    } catch {
      setError("데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!achieveRate) return;
    setSubmitting(true);
    setSubmitMsg("");
    try {
      const res = await fetch(`/api/registry/${id}/kpi-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          achieveRate: parseFloat(achieveRate),
          ...(kpiActual !== "" ? { kpiActual: parseFloat(kpiActual) } : {}),
          ...(rationale.trim() ? { note: rationale.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitMsg(data.error ?? "저장 실패");
      } else {
        setSubmitMsg("저장되었습니다.");
        setAchieveRate("");
        setKpiActual("");
        setRationale("");
        await load();
      }
    } catch {
      setSubmitMsg("저장 중 오류");
    } finally {
      setSubmitting(false);
    }
  };

  const role = (session?.user as any)?.role;
  const canWrite = role === "AX_TEAM" || role === "DATA_PLATFORM";

  if (status === "loading" || loading) {
    return <p className="p-6 text-sm text-[var(--muted)]">불러오는 중…</p>;
  }
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!agent) return null;

  const isProduction = agent.phase === "PRODUCTION";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-[var(--muted)] hover:underline"
        >
          ← 뒤로
        </button>
        <h1 className="text-2xl font-bold mt-1">KPI 실적 입력</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">{agent.agentName}</p>
      </div>

      {/* 에이전트 상태 */}
      <div className="bg-white rounded-xl border border-[#1E1E1E] p-4 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-xs text-[var(--muted)]">단계</span>
          <p className="font-medium">{agent.phase}{agent.prodStatus ? ` · ${agent.prodStatus}` : ""}</p>
        </div>
        {agent.prodKpiTarget && (
          <div>
            <span className="text-xs text-[var(--muted)]">상용 KPI 목표</span>
            <p className="font-medium text-xs">{agent.prodKpiTarget}</p>
          </div>
        )}
        {agent.retireFlag && (
          <div className="ml-auto space-y-1 text-right">
            <span className="bg-red-100 text-red-700 border border-red-200 text-xs font-semibold px-2 py-1 rounded-full">
              ⚠ RETIRE 후보
            </span>
            {agent.retireFlagReason && (
              <p className="text-xs text-red-600">{agent.retireFlagReason}</p>
            )}
          </div>
        )}
      </div>

      {!isProduction && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          PRODUCTION 단계 에이전트만 KPI 실적을 기록할 수 있습니다. (현재 단계: {agent.phase})
        </div>
      )}

      {/* 입력 폼 */}
      {isProduction && canWrite && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#1E1E1E] p-5 space-y-4">
          <h2 className="font-semibold text-sm">월별 KPI 실적 입력</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">대상 월 *</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="w-full border border-[#1E1E1E] rounded px-2 py-1.5 text-sm bg-white text-[#E0E0E0]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">달성률 (%) *</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={achieveRate}
                onChange={(e) => setAchieveRate(e.target.value)}
                required
                placeholder="예: 85.5"
                className="w-full border border-[#1E1E1E] rounded px-2 py-1.5 text-sm bg-white text-[#E0E0E0]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">실측값 (선택)</label>
              <input
                type="number"
                step={0.01}
                value={kpiActual}
                onChange={(e) => setKpiActual(e.target.value)}
                placeholder="측정값"
                className="w-full border border-[#1E1E1E] rounded px-2 py-1.5 text-sm bg-white text-[#E0E0E0]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">비고 (선택)</label>
              <input
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="특이사항, 조정 사유 등"
                className="w-full border border-[#1E1E1E] rounded px-2 py-1.5 text-sm bg-white text-[#E0E0E0]"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#FF6600] text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-[#0E0E0E] disabled:opacity-50"
            >
              {submitting ? "저장 중…" : "저장"}
            </button>
            {submitMsg && (
              <span className={`text-xs ${submitMsg.includes("실패") || submitMsg.includes("오류") ? "text-red-500" : "text-green-600"}`}>
                {submitMsg}
              </span>
            )}
          </div>
        </form>
      )}

      {/* 실적 이력 */}
      <div className="bg-white rounded-xl border border-[#1E1E1E] overflow-x-auto">
        <div className="px-4 py-3 border-b border-[#1E1E1E]">
          <h2 className="font-semibold text-sm">월별 KPI 실적 이력</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#000000] border-b border-[#1E1E1E]">
            <tr>
              {["대상 월", "달성률", "실측값", "비고", "단계", "입력일"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[var(--muted)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agent.scores.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                  기록된 KPI 실적 없음
                </td>
              </tr>
            )}
            {agent.scores.map((s) => (
              <tr key={s.id} className="border-t border-[#1E1E1E] hover:bg-[#000000]">
                <td className="px-4 py-2.5 font-medium">{s.month}</td>
                <td className="px-4 py-2.5">
                  <span className={`font-semibold ${s.achieveRate >= 60 ? "text-green-600" : "text-red-500"}`}>
                    {s.achieveRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[var(--muted)]">
                  {s.kpiActual != null
                    ? (() => { try { const v = typeof s.kpiActual === 'string' ? JSON.parse(s.kpiActual) : s.kpiActual; return typeof v === 'number' ? v.toFixed(2) : String(v); } catch { return String(s.kpiActual); } })()
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-[var(--muted)] max-w-[160px] truncate" title={s.rationale ?? ""}>
                  {s.rationale || "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-[#EBF1F9] text-[#FF6600] px-1.5 py-0.5 rounded font-medium">
                    {s.phase}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-[var(--muted)] whitespace-nowrap">
                  {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
