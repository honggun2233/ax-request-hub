'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface DataProvision {
  id: string
  deliveryMode: 'API' | 'FILE' | 'DB'
  providedAt: string
  expiresAt: string
  revokedAt?: string | null
}

interface DataRequest {
  id: string
  type: 'ACCESS' | 'NEW'
  status: string
  classification: 'G1' | 'G2' | 'G3'
  periodMonths: number
  rejectReason?: string | null
  createdAt: string
  requesterId: string
  asset?: { name: string; classification: string } | null
  provision?: DataProvision | null
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
  EXPIRED: 'bg-gray-100 text-gray-400',
  REVOKED: 'bg-gray-100 text-gray-400',
}

const CLASS_COLOR: Record<string, string> = {
  G1: 'bg-green-100 text-green-800',
  G2: 'bg-yellow-100 text-yellow-800',
  G3: 'bg-red-100 text-red-800',
}

function getDDay(expiresAt: string, revokedAt?: string | null): { label: string; urgent: boolean; expired: boolean } {
  if (revokedAt) return { label: '폐기됨', urgent: false, expired: true }
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: '만료됨', urgent: false, expired: true }
  if (diffDays === 0) return { label: 'D-Day', urgent: true, expired: false }
  const urgent = diffDays <= 30
  return { label: `D-${diffDays}`, urgent, expired: false }
}

function SkeletonCard() {
  return <div className="animate-pulse h-28 bg-gray-100 rounded-xl" />
}

export default function MyDataPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [requests, setRequests] = useState<DataRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return

    const userId = (session?.user as any)?.id

    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/data/requests')
        const json = await res.json()
        const all: DataRequest[] = Array.isArray(json) ? json : []

        // Filter to current user's own requests only
        const mine = all.filter((r) => r.requesterId === userId)

        // For PROVISIONED requests, fetch individual detail to get provision data
        const withProvisions = await Promise.all(
          mine.map(async (r) => {
            if (r.status === 'PROVISIONED') {
              try {
                const detailRes = await fetch(`/api/data/requests/${r.id}`)
                if (detailRes.ok) {
                  const detail: DataRequest = await detailRes.json()
                  return { ...r, provision: detail.provision }
                }
              } catch {
                // fall through
              }
            }
            return r
          })
        )

        setRequests(withProvisions)
      } catch {
        setRequests([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [status, session])

  const provisions = requests.filter((r) => r.provision)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">내 데이터 신청·제공 현황</h1>
        <p className="text-sm text-gray-500 mt-0.5">데이터 이용 신청 내역 및 제공받은 데이터 목록</p>
      </div>

      {/* My requests */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          내가 신청한 데이터
          {!loading && (
            <span className="ml-2 text-sm font-normal text-gray-400">{requests.length}건</span>
          )}
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm bg-gray-50 rounded-xl">
            신청 내역이 없습니다
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {requests.map((req) => (
              <div key={req.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900 leading-tight">
                    {req.asset?.name ?? '(자산명 없음)'}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                      STATUS_COLOR[req.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {STATUS_LABELS[req.status] ?? req.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      CLASS_COLOR[req.classification] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {req.classification}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                    {req.type}
                  </span>
                  <span className="text-xs text-gray-400">{req.periodMonths}개월</span>
                  <span className="text-xs text-gray-400">
                    {new Date(req.createdAt).toLocaleDateString('ko-KR')} 신청
                  </span>
                </div>

                {req.status === 'REJECTED' && req.rejectReason && (
                  <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <span className="text-xs text-red-500 font-medium">반려 사유 </span>
                    <span className="text-xs text-red-700">{req.rejectReason}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Received provisions */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          제공받은 데이터
          {!loading && (
            <span className="ml-2 text-sm font-normal text-gray-400">{provisions.length}건</span>
          )}
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : provisions.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm bg-gray-50 rounded-xl">
            제공받은 데이터가 없습니다
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {provisions.map((req) => {
              const prov = req.provision!
              const dday = getDDay(prov.expiresAt, prov.revokedAt)

              return (
                <div
                  key={prov.id}
                  className={`rounded-xl shadow-sm p-4 space-y-2.5 ${
                    dday.expired ? 'bg-gray-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`font-semibold leading-tight ${
                        dday.expired ? 'text-gray-400' : 'text-gray-900'
                      }`}
                    >
                      {req.asset?.name ?? '(자산명 없음)'}
                    </p>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap ${
                        dday.expired
                          ? 'text-gray-400'
                          : dday.urgent
                          ? 'text-orange-500'
                          : 'text-gray-500'
                      }`}
                    >
                      {dday.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        dday.expired
                          ? 'bg-gray-100 text-gray-400'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {prov.deliveryMode}
                    </span>
                    <span className={`text-xs ${dday.expired ? 'text-gray-400' : 'text-gray-500'}`}>
                      제공일 {new Date(prov.providedAt).toLocaleDateString('ko-KR')}
                    </span>
                    <span
                      className={`text-xs ${
                        dday.expired ? 'text-gray-400' : dday.urgent ? 'text-orange-500 font-medium' : 'text-gray-500'
                      }`}
                    >
                      만료일 {new Date(prov.expiresAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>

                  {prov.revokedAt && (
                    <p className="text-xs text-gray-400">
                      폐기일: {new Date(prov.revokedAt).toLocaleDateString('ko-KR')}
                    </p>
                  )}

                  {dday.urgent && !dday.expired && (
                    <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5">
                      <p className="text-xs text-orange-600 font-medium">만료 30일 이내 — 갱신이 필요할 수 있습니다</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
