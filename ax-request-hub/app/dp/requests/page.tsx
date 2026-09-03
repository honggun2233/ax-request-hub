'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { CONF_LABEL, CONF_COLOR } from '@/lib/confidentiality'

interface DataRequest {
  id: string
  type: 'ACCESS' | 'NEW'
  status: string
  assetId?: string
  requesterId: string
  purpose: string
  requestedSpec?: string
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL'
  periodMonths: number
  forProduction: boolean
  rejectReason?: string
  reviewerId?: string
  createdAt: string
  updatedAt: string
  asset?: { name: string; classification: string }
  project?: { title: string }
  trackType?: string
  accessType?: string
  isAnonymized?: boolean
  anonNote?: string
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: '신청됨',
  REVIEWING: '검토중',
  OWNER_REVIEW: '오너검토',
  SEC_REVIEW: '보안검토',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
  COLLECTING: '수집중',
  PROVISIONED: '제공완료',
  EXPIRED: '만료',
  REVOKED: '폐기',
}

const STATUS_COLOR: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-700',
  REVIEWING: 'bg-yellow-100 text-yellow-700',
  OWNER_REVIEW: 'bg-amber-100 text-amber-700',
  SEC_REVIEW: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  COLLECTING: 'bg-purple-100 text-purple-700',
  PROVISIONED: 'bg-gray-100 text-gray-600',
}


type Tab = 'pending' | 'reviewing' | 'done'

const TAB_STATUSES: Record<Tab, string[]> = {
  pending: ['REQUESTED'],
  reviewing: ['REVIEWING', 'OWNER_REVIEW', 'SEC_REVIEW'],
  done: ['APPROVED', 'REJECTED', 'COLLECTING', 'PROVISIONED'],
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function ClassBadge({ cls }: { cls: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONF_COLOR[cls] ?? 'bg-gray-100 text-gray-600'}`}>
      {CONF_LABEL[cls] ?? cls}
    </span>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[var(--muted)] text-xs min-w-[72px] shrink-0 pt-0.5">{label}</span>
      <span className="text-gray-800 text-sm">{value}</span>
    </div>
  )
}

// ── 회수 영향도 확인 모달 ─────────────────────────────────────────────────────
interface ImpactSummary {
  total: number; highRisk: number
  affectedAgents: Array<{ agentId: string; agentName: string; lifecycleStage: string; riskLevel: string }>
}

function RevokeConfirmModal({
  assetId,
  assetName,
  onConfirm,
  onCancel,
}: {
  assetId: string
  assetName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [impact, setImpact] = useState<ImpactSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/data/assets/${assetId}/impact`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setImpact({
        total: d.summary.total,
        highRisk: d.summary.highRisk,
        affectedAgents: d.affectedAgents ?? [],
      }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [assetId])

  const STAGE_LABEL: Record<string, string> = {
    GATE1: 'Gate 1', GATE2: 'Gate 2', GATE3: 'Gate 3',
    PILOT: '파일럿', PROD: '운영', OPERATION: '운영',
  }
  const RISK_COLOR: Record<string, string> = {
    HIGH: 'bg-red-100 text-red-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    LOW: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="text-red-500 shrink-0" size={20} />
          <h3 className="text-base font-bold text-gray-900">데이터 회수 확인</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <span className="font-semibold text-gray-800">{assetName}</span> 자산을 회수하면
          연관 에이전트가 즉시 중단됩니다.
        </p>

        {loading && (
          <div className="flex justify-center py-6 text-gray-400">
            <Loader2 size={16} className="animate-spin mr-2" /> 영향도 분석 중…
          </div>
        )}

        {!loading && impact && (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                <p className="text-xl font-bold text-gray-800">{impact.total}</p>
                <p className="text-xs text-gray-500 mt-0.5">영향받는 에이전트</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${impact.highRisk > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                <p className={`text-xl font-bold ${impact.highRisk > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {impact.highRisk}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">고위험(운영 중)</p>
              </div>
            </div>

            {/* 고위험 경고 배너 */}
            {impact.highRisk > 0 && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4 text-xs text-red-700">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span><strong>{impact.highRisk}개</strong> 에이전트가 Gate2 이상 운영 단계입니다. 회수 시 즉시 SUSPENDED 처리됩니다.</span>
              </div>
            )}

            {/* 에이전트 목록 (최대 5개) */}
            {impact.affectedAgents.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-4 max-h-36 overflow-y-auto">
                {impact.affectedAgents.slice(0, 5).map(a => (
                  <div key={a.agentId} className="flex items-center justify-between text-xs rounded-lg border border-gray-100 px-3 py-2">
                    <span className="text-gray-700 font-medium truncate mr-2">{a.agentName}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-gray-400">{STAGE_LABEL[a.lifecycleStage] ?? a.lifecycleStage}</span>
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${RISK_COLOR[a.riskLevel]}`}>
                        {a.riskLevel === 'HIGH' ? '고위험' : a.riskLevel === 'MEDIUM' ? '중위험' : '저위험'}
                      </span>
                    </div>
                  </div>
                ))}
                {impact.affectedAgents.length > 5 && (
                  <p className="text-xs text-gray-400 text-center">외 {impact.affectedAgents.length - 5}개…</p>
                )}
              </div>
            )}

            {impact.total === 0 && (
              <p className="text-xs text-gray-400 text-center py-3 mb-4">영향받는 에이전트가 없습니다.</p>
            )}
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            회수 확정
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestSheet({
  req,
  onClose,
  onDone,
}: {
  req: DataRequest
  onClose: () => void
  onDone: () => void
}) {
  const [newStatus, setNewStatus] = useState(req.status)
  const [rejectReason, setRejectReason] = useState(req.rejectReason ?? '')
  const [deliveryMode, setDeliveryMode] = useState<'API' | 'FILE' | 'DB'>('API')
  const [connectionRef, setConnectionRef] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showRevokeModal, setShowRevokeModal] = useState(false)

  const showProvisionForm = newStatus === 'APPROVED'
  const showRejectReason = newStatus === 'REJECTED'
  // REVOKED는 PROVISIONED/COLLECTING 상태일 때만 선택 가능
  const canRevoke = ['PROVISIONED', 'COLLECTING'].includes(req.status)

  const handleSubmit = async () => {
    // REVOKED 선택 시 먼저 영향도 확인 모달
    if (newStatus === 'REVOKED') {
      setShowRevokeModal(true)
      return
    }
    await doSubmit()
  }

  const doSubmit = async () => {
    setError('')
    if (showRejectReason && !rejectReason.trim()) {
      setError('반려 사유를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      let res: Response
      if (newStatus === 'REVIEWING') {
        res = await fetch(`/api/dp/requests/${req.id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      } else if (newStatus === 'SEC_REVIEW') {
        res = await fetch(`/api/dp/requests/${req.id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secReview: true }),
        })
      } else {
        res = await fetch(`/api/data/requests/${req.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            ...(showRejectReason ? { rejectReason } : {}),
          }),
        })
      }
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? '처리 실패')
      }

      if (showProvisionForm && connectionRef.trim() && expiresAt) {
        const provRes = await fetch('/api/data/provisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: req.id,
            deliveryMode,
            connectionRef: connectionRef.trim(),
            expiresAt,
          }),
        })
        if (!provRes.ok) {
          const json = await provRes.json()
          throw new Error(json.error ?? '제공 정보 생성 실패')
        }
      }

      onDone()
    } catch (err: any) {
      setError(err.message ?? '오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">
              {req.asset?.name ?? '(자산 없음)'}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">ID: {req.id.slice(0, 12)}…</p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-gray-700 text-2xl leading-none ml-4 mt-0.5"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Request details */}
          <div className="space-y-2.5">
            <Row label="신청자 ID" value={req.requesterId} />
            <Row
              label="신청유형"
              value={
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                  {req.type === 'ACCESS' ? '이용신청 (ACCESS)' : '신규요청 (NEW)'}
                </span>
              }
            />
            <Row label="기밀등급" value={<ClassBadge cls={req.classification} />} />
            <Row label="이용기간" value={`${req.periodMonths}개월`} />
            <Row label="프로덕션" value={req.forProduction ? '예' : '아니오'} />
            {req.trackType && (
              <Row
                label="이용 트랙"
                value={
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    req.trackType === 'A' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                  }`}>
                    Track {req.trackType} — {req.trackType === 'A' ? '데이터 활용' : 'AI 연계'}
                  </span>
                }
              />
            )}
            {req.accessType && (
              <Row label="접근 유형" value={req.accessType} />
            )}
            {req.isAnonymized !== undefined && (
              <Row
                label="비식별 처리"
                value={
                  req.isAnonymized
                    ? <span className="text-xs text-green-700 font-medium">적용 {req.anonNote ? `(${req.anonNote})` : ''}</span>
                    : <span className="text-xs text-[var(--muted)]">미적용</span>
                }
              />
            )}
            <Row
              label="신청일"
              value={new Date(req.createdAt).toLocaleDateString('ko-KR')}
            />
            {req.project && <Row label="연계 AI 활용" value={req.project.title} />}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-[var(--muted)]">이용 목적</p>
            <p className="text-sm text-gray-800 leading-relaxed">{req.purpose}</p>
          </div>

          {req.requestedSpec && (
            <div className="space-y-1">
              <p className="text-xs text-[var(--muted)]">요청 명세</p>
              <p className="text-sm text-gray-800 leading-relaxed">{req.requestedSpec}</p>
            </div>
          )}

          {req.rejectReason && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs text-red-500 mb-1">기존 반려 사유</p>
              <p className="text-sm text-red-700">{req.rejectReason}</p>
            </div>
          )}

          <hr />

          {/* Status change */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 block">상태 변경</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-300"
            >
              {['REVIEWING', 'OWNER_REVIEW', 'SEC_REVIEW', 'APPROVED', 'REJECTED', 'COLLECTING', 'PROVISIONED'].map(
                (s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]} ({s})
                  </option>
                )
              )}
              {canRevoke && (
                <option value="REVOKED">⚠ 회수 (REVOKED)</option>
              )}
            </select>
            {newStatus === 'REVOKED' && (
              <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                <AlertTriangle size={11} /> 회수 시 연관 에이전트가 자동으로 SUSPENDED 처리됩니다.
              </p>
            )}
          </div>

          {/* Reject reason */}
          {showRejectReason && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 block">
                반려 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="반려 사유를 입력하세요"
                className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:border-blue-300"
              />
            </div>
          )}

          {/* Provision form */}
          {showProvisionForm && (
            <div className="space-y-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-800">DataProvision 생성</p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 block">제공 방식</label>
                <div className="flex gap-4">
                  {(['API', 'FILE', 'DB'] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                      <input
                        type="radio"
                        name="deliveryMode"
                        value={mode}
                        checked={deliveryMode === mode}
                        onChange={() => setDeliveryMode(mode)}
                        className="accent-blue-600"
                      />
                      {mode}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 block">연결 참조 (connectionRef)</label>
                <input
                  type="text"
                  value={connectionRef}
                  onChange={(e) => setConnectionRef(e.target.value)}
                  placeholder="s3://bucket/path 또는 jdbc:..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 block">만료일</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-300"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`w-full py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors ${
              newStatus === 'REVOKED'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? '처리 중...' : newStatus === 'REVOKED' ? '회수 처리' : '처리 완료'}
          </button>
        </div>
      </div>

      {/* 회수 영향도 확인 모달 */}
      {showRevokeModal && req.assetId && (
        <RevokeConfirmModal
          assetId={req.assetId}
          assetName={req.asset?.name ?? ''}
          onConfirm={doSubmit}
          onCancel={() => setShowRevokeModal(false)}
        />
      )}
    </div>
  )
}

export default function DPRequestsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const role = (session?.user as any)?.role

  const [tab, setTab] = useState<Tab>('pending')
  const [requests, setRequests] = useState<DataRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DataRequest | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    // 개발 단계: role 제한 없음
  }, [status, router])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/data/requests')
      const json = await res.json()
      setRequests(Array.isArray(json) ? json : [])
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') fetchRequests()
  }, [status, fetchRequests])

  const countFor = (t: Tab) => requests.filter((r) => TAB_STATUSES[t].includes(r.status)).length
  const filtered = requests.filter((r) => TAB_STATUSES[tab].includes(r.status))

  const TAB_LABELS: Record<Tab, string> = {
    pending: `대기중 (${countFor('pending')})`,
    reviewing: `검토중 (${countFor('reviewing')})`,
    done: `완료 (${countFor('done')})`,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">데이터 요청 검토</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          데이터 이용 신청 및 신규 수집 요청을 검토합니다
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['pending', 'reviewing', 'done'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-[var(--muted)] hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse h-12 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted)] text-sm">해당 탭에 건이 없습니다</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">자산명</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">신청자</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">신청유형</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">기밀등급</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">신청일</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => setSelected(req)}
                  className="border-b last:border-0 cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {req.asset?.name ?? '(자산 없음)'}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)] font-mono text-xs">
                    {req.requesterId.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                      {req.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ClassBadge cls={req.classification} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(req.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over sheet */}
      {selected && (
        <RequestSheet
          req={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null)
            fetchRequests()
          }}
        />
      )}
    </div>
  )
}
