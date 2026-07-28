'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface DataRequest {
  id: string
  type: 'ACCESS' | 'NEW'
  status: string
  assetId?: string
  requesterId: string
  purpose: string
  requestedSpec?: string
  classification: 'G1' | 'G2' | 'G3'
  periodMonths: number
  forProduction: boolean
  rejectReason?: string
  reviewerId?: string
  createdAt: string
  updatedAt: string
  asset?: { name: string; classification: string }
  project?: { title: string }
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: '신청됨',
  REVIEWING: '검토중',
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
  SEC_REVIEW: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  COLLECTING: 'bg-purple-100 text-purple-700',
  PROVISIONED: 'bg-gray-100 text-gray-600',
}

const CLASS_COLOR: Record<string, string> = {
  G1: 'bg-green-100 text-green-800',
  G2: 'bg-yellow-100 text-yellow-800',
  G3: 'bg-red-100 text-red-800',
}

type Tab = 'pending' | 'reviewing' | 'done'

const TAB_STATUSES: Record<Tab, string[]> = {
  pending: ['REQUESTED'],
  reviewing: ['REVIEWING', 'SEC_REVIEW'],
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
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLASS_COLOR[cls] ?? 'bg-gray-100 text-gray-600'}`}>
      {cls}
    </span>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 text-xs min-w-[72px] shrink-0 pt-0.5">{label}</span>
      <span className="text-gray-800 text-sm">{value}</span>
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

  const showProvisionForm = newStatus === 'APPROVED'
  const showRejectReason = newStatus === 'REJECTED'

  const handleSubmit = async () => {
    setError('')
    if (showRejectReason && !rejectReason.trim()) {
      setError('반려 사유를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/data/requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(showRejectReason ? { rejectReason } : {}),
        }),
      })
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
            <p className="text-xs text-gray-400 mt-0.5">ID: {req.id.slice(0, 12)}…</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-4 mt-0.5"
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
            <Row
              label="신청일"
              value={new Date(req.createdAt).toLocaleDateString('ko-KR')}
            />
            {req.project && <Row label="연계 과제" value={req.project.title} />}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-gray-400">이용 목적</p>
            <p className="text-sm text-gray-800 leading-relaxed">{req.purpose}</p>
          </div>

          {req.requestedSpec && (
            <div className="space-y-1">
              <p className="text-xs text-gray-400">요청 명세</p>
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
              {['REVIEWING', 'SEC_REVIEW', 'APPROVED', 'REJECTED', 'COLLECTING', 'PROVISIONED'].map(
                (s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]} ({s})
                  </option>
                )
              )}
            </select>
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
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? '처리 중...' : '처리 완료'}
          </button>
        </div>
      </div>
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
        <p className="text-sm text-gray-500 mt-0.5">
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
                : 'border-transparent text-gray-500 hover:text-gray-700'
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
        <div className="text-center py-16 text-gray-400 text-sm">해당 탭에 건이 없습니다</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-500">자산명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">신청자</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">신청유형</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">기밀등급</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">신청일</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
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
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
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
                  <td className="px-4 py-3 text-gray-500">
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
