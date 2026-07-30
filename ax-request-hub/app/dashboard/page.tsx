import Link from 'next/link'
import { db } from '@/src/lib/db'
import { ApproveButtons } from './ApproveButtons'

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  submitted: { label: '접수', badgeClass: 'bg-gray-100 text-gray-600' },
  evaluated: { label: '검토 중', badgeClass: 'bg-yellow-100 text-yellow-700' },
  pilot: { label: '파일럿', badgeClass: 'bg-blue-100 text-blue-700' },
  production: { label: '운영', badgeClass: 'bg-green-100 text-green-700' },
  closed: { label: '종료', badgeClass: 'bg-red-100 text-red-600' },
}

const STATUS_ORDER = ['submitted', 'evaluated', 'pilot', 'production', 'closed']

export default async function DashboardPage() {
  const projects = await db.project.findMany({
    include: { scoreCard: true },
    orderBy: { createdAt: 'desc' },
  })
  const byStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = projects.filter((p) => p.status === status)
    return acc
  }, {} as Record<string, typeof projects>)

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AX 과제 포트폴리오</h1>
            <p className="text-sm text-gray-500 mt-1">총 {projects.length}개 과제</p>
          </div>
          <Link
            href="/chat"
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + 과제 신청
          </Link>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {STATUS_ORDER.map((status) => {
            const config = STATUS_CONFIG[status]
            const items = byStatus[status] ?? []
            return (
              <div key={status}>
                <div className={`text-xs font-semibold px-2 py-1 rounded-lg inline-flex items-center gap-1 mb-3 ${config.badgeClass}`}>
                  {config.label} <span className="opacity-60">({items.length})</span>
                </div>
                <div className="space-y-3">
                  {items.map((project) => (
                    <div key={project.id} className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                          {project.title}
                        </h3>
                        <span className="text-xs text-gray-400 shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">
                          {project.confidentialityLevel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{project.department}</p>
                      {project.scoreCard && (
                        <div className="text-sm font-bold text-blue-600 mb-2">
                          {project.scoreCard.totalScore.toFixed(1)}점
                          {project.autoApproved && (
                            <span className="ml-1.5 text-xs text-green-600 font-normal">(자동 승인)</span>
                          )}
                        </div>
                      )}
                      {project.status === 'evaluated' && (
                        <ApproveButtons projectId={project.id} />
                      )}
                      <Link href={`/status/${project.id}`} className="block text-xs text-blue-500 hover:underline mt-2">
                        상세 보기 →
                      </Link>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-4">없음</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
