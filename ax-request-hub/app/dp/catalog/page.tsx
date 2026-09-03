'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronRight, Database, X, Loader2 } from 'lucide-react'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface DataAsset {
  id: string; name: string; description: string; ownerDept: string
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL'; deliveryModes: string
  updateCycle?: string; isActive: boolean; createdAt: string
  _count?: { requests: number }
}

interface AffectedAgent {
  agentId: string; agentName: string; lifecycleStage: string
  connectionType: 'DIRECT' | 'VIA_PROJECT'; projectName?: string
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'
}

interface ImpactResult {
  assetId: string; assetName: string; classification: string
  affectedAgents: AffectedAgent[]
  summary: { total: number; highRisk: number; byStage: Record<string, number> }
}

// ── 상수 ──────────────────────────────────────────────────────────────────────
const CONF_LABEL: Record<string, string> = { G1: 'G1 기밀', G2: 'G2 내부', G3: 'G3 공개' }
const CONF_COLOR: Record<string, string> = {
  G1: 'bg-red-100 text-red-700 border-red-200',
  G2: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  G3: 'bg-green-100 text-green-700 border-green-200',
}

const STAGE_LABEL: Record<string, string> = {
  IDEA: '아이디어', GATE1: 'Gate 1', GATE2: 'Gate 2', GATE3: 'Gate 3',
  PILOT: '파일럿', PROD: '운영', OPERATION: '운영', RETIRED: '폐기',
}

const RISK_COLOR: Record<string, string> = {
  HIGH:   'bg-red-100 text-red-700 border-red-300',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  LOW:    'bg-gray-100 text-gray-600 border-gray-200',
}

// ── 영향도 배지 ───────────────────────────────────────────────────────────────
function ImpactBadge({
  assetId, onOpen,
}: { assetId: string; onOpen: (id: string) => void }) {
  const [impact, setImpact] = useState<{ total: number; highRisk: number } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/data/assets/${assetId}/impact`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setImpact({ total: d.summary.total, highRisk: d.summary.highRisk }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [assetId])

  if (loading) return <span className="text-xs text-gray-400">…</span>
  if (!impact) return null

  const hasRisk = impact.highRisk > 0
  return (
    <button
      onClick={e => { e.stopPropagation(); onOpen(assetId) }}
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border
        ${hasRisk
          ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
          : impact.total > 0
            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            : 'bg-gray-50 text-gray-500 border-gray-200'
        }`}
    >
      {hasRisk && <AlertTriangle size={10} />}
      에이전트 {impact.total}
      {hasRisk && <span className="text-red-500">({impact.highRisk} 고위험)</span>}
    </button>
  )
}

// ── 영향도 SlideOver ───────────────────────────────────────────────────────────
function ImpactSlideOver({
  assetId, onClose,
}: { assetId: string | null; onClose: () => void }) {
  const [data, setData] = useState<ImpactResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!assetId) return
    setData(null)
    setLoading(true)
    fetch(`/api/data/assets/${assetId}/impact`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [assetId])

  if (!assetId) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 배경 */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* 패널 */}
      <div className="w-[480px] bg-white h-full shadow-xl flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h2 className="text-base font-bold text-gray-800">영향도 분석</h2>
            {data && (
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="font-medium text-gray-700">{data.assetName}</span> 회수 시 영향받는 에이전트
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex justify-center py-12 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> 분석 중…
            </div>
          )}

          {!loading && data && (
            <>
              {/* 요약 KPI */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{data.summary.total}</p>
                  <p className="text-xs text-gray-500 mt-0.5">전체 에이전트</p>
                </div>
                <div className={`rounded-lg border p-3 text-center ${data.summary.highRisk > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${data.summary.highRisk > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {data.summary.highRisk}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">운영 중(고위험)</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">
                    {Object.keys(data.summary.byStage).length}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">관련 단계</p>
                </div>
              </div>

              {/* 고위험 경고 */}
              {data.summary.highRisk > 0 && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-700">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>{data.summary.highRisk}개 에이전트</strong>가 Gate2 이후 운영 단계입니다.
                    회수 시 즉시 운영 중단될 수 있습니다.
                  </span>
                </div>
              )}

              {/* 에이전트 목록 */}
              {data.affectedAgents.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">영향받는 에이전트가 없습니다.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.affectedAgents.map(a => (
                    <div key={a.agentId} className="rounded-lg border border-gray-100 bg-white px-4 py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{a.agentName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {a.connectionType === 'DIRECT' ? '직접 연결' : `과제 경유 — ${a.projectName ?? ''}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${RISK_COLOR[a.riskLevel]}`}>
                          {a.riskLevel === 'HIGH' ? '고위험' : a.riskLevel === 'MEDIUM' ? '중위험' : '저위험'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {STAGE_LABEL[a.lifecycleStage] ?? a.lifecycleStage}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function DpCatalogPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [assets, setAssets]       = useState<DataAsset[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [clsFilter, setClsFilter] = useState('')
  const [impactAssetId, setImpactAssetId] = useState<string | null>(null)

  const role = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status !== 'authenticated') return
    if (!['AX_TEAM', 'DATA_PLATFORM'].includes(role)) { router.replace('/'); return }
  }, [status, role, router])

  const fetchAssets = useCallback(() => {
    setLoading(true)
    const q = new URLSearchParams()
    if (search)    q.set('search', search)
    if (clsFilter) q.set('classification', clsFilter)
    fetch(`/api/data/assets?${q}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAssets(Array.isArray(d) ? d : []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false))
  }, [search, clsFilter])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">데이터 카탈로그</h1>
          <p className="text-sm text-gray-500 mt-1">데이터 자산 목록 및 에이전트 영향도 조회</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">전체 {assets.length}건</span>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 mb-5">
        <input
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="데이터 자산명 검색…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchAssets()}
        />
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={clsFilter}
          onChange={e => setClsFilter(e.target.value)}
        >
          <option value="">전체 등급</option>
          <option value="PUBLIC">G1 기밀</option>
          <option value="RESTRICTED">G2 내부</option>
          <option value="CONFIDENTIAL">G3 공개</option>
        </select>
        <button
          onClick={fetchAssets}
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          검색
        </button>
      </div>

      {/* 자산 목록 */}
      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 불러오는 중…
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">데이터 자산이 없습니다.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {assets.map(asset => (
            <div
              key={asset.id}
              className="bg-white border border-gray-100 rounded-xl px-5 py-4 hover:border-blue-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* 좌측: 기본 정보 */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Database size={18} className="text-blue-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{asset.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CONF_COLOR[asset.classification]}`}>
                        {CONF_LABEL[asset.classification]}
                      </span>
                      <ImpactBadge assetId={asset.id} onOpen={setImpactAssetId} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">{asset.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {asset.ownerDept} · {asset.deliveryModes} · 신청 {asset._count?.requests ?? 0}건
                    </p>
                  </div>
                </div>

                {/* 우측: 영향도 열기 버튼 */}
                <button
                  onClick={() => setImpactAssetId(asset.id)}
                  className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-0.5 shrink-0"
                >
                  영향도 <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 영향도 SlideOver */}
      <ImpactSlideOver assetId={impactAssetId} onClose={() => setImpactAssetId(null)} />
    </div>
  )
}
