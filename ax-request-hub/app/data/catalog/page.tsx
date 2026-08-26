'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CONF_LABEL, CONF_COLOR } from '@/lib/confidentiality'

// ── Types ──────────────────────────────────────────────────────
interface DataAsset {
  id: string
  name: string
  classification: 'G1' | 'G2' | 'G3'
  ownerDept: string
  updateCycle?: string
  deliveryModes?: string
  description?: string
  isActive: boolean
}

interface ModalState {
  asset: DataAsset
  type: 'ACCESS' | 'NEW'
}

// ── Skeleton card ──────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="animate-pulse bg-gray-100 rounded-xl h-40" />
  )
}

// ── DataAsset Card ─────────────────────────────────────────────
function AssetCard({ asset, onRequest }: { asset: DataAsset; onRequest: (asset: DataAsset, type: 'ACCESS' | 'NEW') => void }) {
  const modes = (asset.deliveryModes ?? '').split(',').map(m => m.trim()).filter(Boolean)

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 leading-tight">{asset.name}</p>
        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${CONF_COLOR[asset.classification] ?? 'bg-gray-100 text-gray-600'}`}>
          {CONF_LABEL[asset.classification] ?? asset.classification}
        </span>
      </div>

      {/* Dept */}
      <p className="text-sm text-[var(--muted)]">{asset.ownerDept}</p>

      {/* Update cycle */}
      {asset.updateCycle && (
        <p className="text-xs text-[var(--muted)]">갱신주기: {asset.updateCycle}</p>
      )}

      {/* Delivery mode chips */}
      {modes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {modes.map(m => (
            <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">{m}</span>
          ))}
        </div>
      )}

      {/* Description */}
      {asset.description && (
        <p className="line-clamp-2 text-sm text-gray-600 flex-1">{asset.description}</p>
      )}

      {/* Buttons */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={() => onRequest(asset, 'ACCESS')}
          title="이 데이터 자산에 대한 접근 권한을 신청합니다"
          className="flex-1 py-1.5 bg-[#4A6FA5] text-white text-sm rounded font-semibold hover:bg-[#1E3560] transition-colors"
        >
          이용 신청
        </button>
        <button
          onClick={() => onRequest(asset, 'NEW')}
          title="현재 카탈로그에 없는 추가 데이터 수집을 요청합니다 (예: 더 넓은 범위, 다른 형태)"
          className="flex-1 py-1.5 border border-[#E4E9F2] text-[var(--muted)] text-sm rounded font-medium hover:bg-[#F7F9FC] transition-colors"
        >
          추가 수집 요청
        </button>
      </div>
    </div>
  )
}

// ── Request Modal ──────────────────────────────────────────────
interface ProjectOption { id: string; title: string }

function RequestModal({ modal, onClose }: { modal: ModalState; onClose: () => void }) {
  const { asset, type } = modal
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [purpose, setPurpose] = useState('')
  const [classification, setClassification] = useState(asset.classification)
  const [periodMonths, setPeriodMonths] = useState(3)
  const [requestedSpec, setRequestedSpec] = useState('')
  const [trackType, setTrackType] = useState<'A' | 'B'>('A')
  const [accessType, setAccessType] = useState<'조회' | '추출' | '반출'>('조회')
  const [isAnonymized, setIsAnonymized] = useState(false)
  const [anonNote, setAnonNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then((d: any[]) => Array.isArray(d) ? setProjects(d.map(p => ({ id: p.id, title: p.title }))) : setProjects([]))
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!purpose.trim()) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/data/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          type,
          projectId: projectId || undefined,
          purpose,
          classification,
          periodMonths,
          requestedSpec: type === 'NEW' ? requestedSpec : undefined,
          trackType,
          accessType,
          isAnonymized,
          anonNote: isAnonymized ? anonNote : undefined,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `서버 오류 (${res.status})`)
      }
      setSuccess(true)
      setTimeout(() => onClose(), 1500)
    } catch (err: any) {
      setErrorMsg(err.message ?? '신청 중 오류가 발생했습니다')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">{asset.name}</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {type === 'ACCESS' ? '이용신청' : '신규 수집 요청'}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-gray-600 text-2xl leading-none ml-4">×</button>
        </div>

        {success ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div>
              <p className="text-2xl mb-2">✓</p>
              <p className="font-semibold text-gray-900">신청이 접수되었습니다</p>
              <p className="text-sm text-[var(--muted)] mt-1">데이터플랫폼팀이 검토 후 처리합니다.</p>
              <a href="/me/data" className="inline-block mt-3 text-sm text-blue-600 hover:underline">내 신청 내역 보기 →</a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Type explanation */}
            <div className={`rounded-lg px-3 py-2.5 text-xs ${type === 'ACCESS' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}>
              {type === 'ACCESS' ? (
                <>
                  <p className="font-semibold mb-0.5">이용 신청 (ACCESS)</p>
                  <p>이 데이터 자산에 대한 접근 권한을 요청합니다. 승인 시 제공 방식(API/FILE/DB)으로 데이터를 이용할 수 있습니다.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold mb-0.5">추가 수집 요청 (NEW)</p>
                  <p>이 자산을 기반으로 현재 카탈로그에 없는 데이터 추가 수집을 요청합니다. 예: 더 넓은 기간 범위, 다른 필드, 실시간 형태 등.</p>
                </>
              )}
            </div>

            {/* Project selector */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">연계 AI 활용 (선택)</label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-blue-300 bg-white"
              >
                <option value="">선택 안함</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            {/* Purpose */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">이용 목적 <span className="text-red-500">*</span></label>
              <textarea
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                required
                rows={3}
                placeholder="이용 목적을 상세히 기재해 주세요"
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:border-blue-300"
              />
            </div>

            {/* Classification — 데이터 오너가 지정, 신청자가 변경 불가 (데이터취급지침 제10조) */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">기밀등급</label>
              <div className={`w-full text-sm border border-gray-200 rounded-lg p-2.5 bg-gray-50 ${CONF_COLOR[classification] ?? ''}`}>
                {CONF_LABEL[classification] ?? classification}
                <span className="ml-2 text-xs text-[var(--muted)]">(데이터 오너 지정, 변경 불가)</span>
              </div>
            </div>

            {/* Track Type — 데이터취급지침 제25조 */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                이용 트랙 <span className="text-red-500">*</span>
                <span className="ml-1 text-[var(--muted)] font-normal">(데이터취급지침 제25조)</span>
              </label>
              <div className="flex gap-2">
                {(['A', 'B'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTrackType(t)}
                    className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${
                      trackType === t
                        ? 'bg-[#4A6FA5] text-white border-[#4A6FA5]'
                        : 'bg-white text-[var(--muted)] border-[#E4E9F2] hover:border-[#4A6FA5] hover:text-[#4A6FA5]'
                    }`}
                  >
                    Track {t} — {t === 'A' ? '데이터 활용' : 'AI 연계'}
                  </button>
                ))}
              </div>
            </div>

            {/* Access Type — 조회/추출/반출 */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">접근 유형 <span className="text-red-500">*</span></label>
              <select
                value={accessType}
                onChange={e => setAccessType(e.target.value as '조회' | '추출' | '반출')}
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-blue-300 bg-white"
              >
                <option value="조회">조회 — 시스템 내 확인만 허용</option>
                <option value="추출">추출 — 파일·API 형태 다운로드 허용</option>
                <option value="반출">반출 — 외부 반출 허용 (추가 심의 필요)</option>
              </select>
            </div>

            {/* Anonymization */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymized}
                  onChange={e => setIsAnonymized(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="text-xs font-medium text-gray-700">비식별 처리 적용</span>
              </label>
              {isAnonymized && (
                <textarea
                  value={anonNote}
                  onChange={e => setAnonNote(e.target.value)}
                  rows={2}
                  placeholder="비식별 처리 방법 및 범위를 기재해 주세요 (예: k-익명화, 마스킹 대상 컬럼 등)"
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:border-blue-300"
                />
              )}
            </div>

            {/* Period months */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">이용 기간(개월)</label>
              <input
                type="number"
                value={periodMonths}
                onChange={e => setPeriodMonths(Number(e.target.value))}
                min={1}
                max={24}
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-blue-300"
              />
            </div>

            {/* Requested spec (NEW only) */}
            {type === 'NEW' && (
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">요청 명세</label>
                <textarea
                  value={requestedSpec}
                  onChange={e => setRequestedSpec(e.target.value)}
                  rows={3}
                  placeholder="수집 대상, 형식, 주기 등을 기재해 주세요"
                  className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:border-blue-300"
                />
              </div>
            )}

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {errorMsg}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !purpose.trim()}
              className="w-full py-2.5 bg-[#4A6FA5] text-white text-sm rounded font-semibold hover:bg-[#1E3560] disabled:opacity-50 transition-colors"
            >
              {submitting ? '제출 중...' : '신청하기'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export default function DataCatalogPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [assets, setAssets] = useState<DataAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<'' | 'G1' | 'G2' | 'G3'>('')
  const [deptFilter, setDeptFilter] = useState('')
  const [modal, setModal] = useState<ModalState | null>(null)

  // Debounced search ref
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // Debounce search input 300ms
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [search])

  // Fetch assets whenever filters change
  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ isActive: 'true' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (classFilter) params.set('classification', classFilter)
      if (deptFilter) params.set('ownerDept', deptFilter)
      const res = await fetch(`/api/data/assets?${params.toString()}`)
      const json = res.ok ? await res.json() : {}
      setAssets(Array.isArray(json.assets) ? json.assets : Array.isArray(json) ? json : [])
    } catch {
      setAssets([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, classFilter, deptFilter])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  // Unique departments from results
  const depts = Array.from(new Set(assets.map(a => a.ownerDept))).filter(Boolean).sort()

  const openModal = (asset: DataAsset, type: 'ACCESS' | 'NEW') => {
    setModal({ asset, type })
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">데이터 카탈로그</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">데이터플랫폼 자산 목록</p>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
          <span><span className="font-semibold text-blue-600">이용 신청</span> — 카탈로그에 등록된 데이터 자산의 접근 권한 요청</span>
          <span><span className="font-semibold text-amber-600">추가 수집 요청</span> — 해당 자산 기반으로 현재 없는 데이터 신규 수집 요청 (범위 확대, 형태 변경 등)</span>
        </div>
      </div>

      {/* Search bar */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="자산명, 설명 검색..."
        className="w-full max-w-lg border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-300 bg-white shadow-sm"
      />

      {/* Filter row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Classification chips */}
        <div className="flex gap-1.5">
          {(['', 'G1', 'G2', 'G3'] as const).map(c => (
            <button
              key={c}
              onClick={() => setClassFilter(c)}
              className={`text-sm px-3 py-1.5 rounded-full border font-medium transition-colors ${
                classFilter === c
                  ? 'bg-[#4A6FA5] text-white border-[#4A6FA5]'
                  : 'bg-white border-[#E4E9F2] text-[var(--muted)] hover:bg-[#F7F9FC]'
              }`}
            >
              {c === '' ? '전체' : CONF_LABEL[c]}
            </button>
          ))}
        </div>

        {/* Dept dropdown */}
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-blue-300"
        >
          <option value="">부서 전체</option>
          {depts.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Card grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted)] text-sm">검색 결과가 없습니다</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map(asset => (
            <AssetCard key={asset.id} asset={asset} onRequest={openModal} />
          ))}
        </div>
      )}

      {/* Request modal */}
      {modal && (
        <RequestModal modal={modal} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
