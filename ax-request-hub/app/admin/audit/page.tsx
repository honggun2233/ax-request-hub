"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const ENTITY_TYPES = [
  "AgentRegistry", "DataRequest", "DataProvision", "DataAsset",
  "Employee", "Project", "LevelApplication",
];

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorEmail: string;
  detail: string | null;
  createdAt: string;
}

interface Result {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  logs: AuditLog[];
}

export default function AdminAuditPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [entityType, setEntityType] = useState("");
  const [action, setAction]         = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [from, setFrom]             = useState("");
  const [to, setTo]                 = useState("");
  const [page, setPage]             = useState(1);
  const LIMIT = 50;

  const [result, setResult]   = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    const sp = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (entityType) sp.set("entityType", entityType);
    if (action)     sp.set("action", action);
    if (actorEmail) sp.set("actorEmail", actorEmail);
    if (from)       sp.set("from", from);
    if (to)         sp.set("to", to);
    const res = await fetch(`/api/admin/audit?${sp}`).then((r) => r.json());
    setResult(res);
    setLoading(false);
  }, [entityType, action, actorEmail, from, to]);

  useEffect(() => {
    if (status === "authenticated") { setPage(1); load(1); }
  }, [status, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1);
  }

  function goPage(p: number) {
    setPage(p);
    load(p);
  }

  const role = (session?.user as any)?.role;
  if (status === "loading") return null;
  if (role !== "AX_TEAM") return <p className="p-6 text-red-600">AX팀 전용 페이지입니다.</p>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <a href="/admin" className="text-sm text-[var(--muted)] hover:underline">← 관리 포털</a>
        <h1 className="text-2xl font-bold mt-1">감사로그 조회</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">전자금융감독규정 §감사기록 — 모든 상태 전이·결정 이력</p>
      </div>

      {/* 필터 */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-[#1E1E1E] p-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">엔티티 유형</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="w-full border border-[#1E1E1E] rounded px-2 py-1.5 text-sm bg-white text-[#E0E0E0]"
          >
            <option value="">전체</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">액션 (부분 검색)</label>
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="예: DATA_REQUEST"
            className="w-full border border-[#1E1E1E] rounded px-2 py-1.5 text-sm bg-white text-[#E0E0E0]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">실행자 이메일</label>
          <input
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
            placeholder="@samsung.com"
            className="w-full border border-[#1E1E1E] rounded px-2 py-1.5 text-sm bg-white text-[#E0E0E0]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">시작일</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full border border-[#1E1E1E] rounded px-2 py-1.5 text-sm bg-white text-[#E0E0E0]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">종료일</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full border border-[#1E1E1E] rounded px-2 py-1.5 text-sm bg-white text-[#E0E0E0]"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full bg-[#FF6600] text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-[#0E0E0E]"
          >
            검색
          </button>
        </div>
      </form>

      {/* 요약 */}
      {result && (
        <div className="text-sm text-[var(--muted)]">
          총 <span className="font-semibold text-[#E0E0E0]">{result.total.toLocaleString()}</span>건
          {result.totalPages > 1 && ` · ${result.page} / ${result.totalPages} 페이지`}
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-[#1E1E1E] overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-[var(--muted)]">로딩 중…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#000000] border-b border-[#1E1E1E]">
              <tr>
                {["시각", "엔티티", "액션", "대상 ID", "실행자", "상세"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[var(--muted)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!result?.logs.length) && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
              {result?.logs.map((log) => {
                let detail = "";
                try { detail = JSON.stringify(JSON.parse(log.detail ?? "{}"), null, 0); } catch { detail = log.detail ?? ""; }
                return (
                  <tr key={log.id} className="border-t border-[#1E1E1E] hover:bg-[#000000]">
                    <td className="px-4 py-2.5 text-xs text-[var(--muted)] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-[#EBF1F9] text-[#FF6600] px-1.5 py-0.5 rounded font-medium">
                        {log.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[#E0E0E0] text-xs whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--muted)]">
                      {log.entityId.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--muted)]">
                      {log.actorEmail}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--muted)] max-w-xs truncate" title={detail}>
                      {detail}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 */}
      {result && result.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
            className="px-3 py-1.5 border border-[#1E1E1E] rounded text-sm hover:bg-[#000000] disabled:opacity-40"
          >
            이전
          </button>
          {Array.from({ length: Math.min(result.totalPages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => goPage(p)}
                className={`px-3 py-1.5 border rounded text-sm ${
                  p === page
                    ? "bg-[#FF6600] text-white border-[#FF6600]"
                    : "border-[#1E1E1E] hover:bg-[#000000] text-[#E0E0E0]"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            disabled={page >= result.totalPages}
            onClick={() => goPage(page + 1)}
            className="px-3 py-1.5 border border-[#1E1E1E] rounded text-sm hover:bg-[#000000] disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
