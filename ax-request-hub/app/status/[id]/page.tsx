import { db } from '@/src/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const STATUS_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  submitted: { label: '접수됨', color: 'bg-gray-100 text-gray-700', desc: 'AI 평가를 기다리고 있습니다.' },
  evaluated: { label: '검토 중', color: 'bg-yellow-100 text-yellow-700', desc: 'AX팀장 검토를 기다리고 있습니다.' },
  pilot: { label: '파일럿 승인', color: 'bg-blue-100 text-blue-700', desc: '파일럿 단계로 승인되었습니다. AX/PI팀에서 연락드립니다.' },
  production: { label: '운영 중', color: 'bg-green-100 text-green-700', desc: '운영 환경에 배포되어 있습니다.' },
  closed: { label: '종료', color: 'bg-red-100 text-red-600', desc: '과제가 종료 또는 반려되었습니다.' },
}

export default async function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await db.project.findUnique({ where: { id }, include: { scoreCard: true } })
  if (!project) notFound()
  const status = STATUS_LABELS[project.status] ?? STATUS_LABELS['submitted']
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto pt-12 pb-12 px-4">
        <h1 className="text-xl font-bold text-gray-900 mb-6">과제 현황</h1>
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{project.title}</h2>
          <p className="text-sm text-gray-500 mb-4">{project.department} · {project.requesterName}</p>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${status.color}`}>
            {status.label}
          </span>
          <p className="text-sm text-gray-600 mt-3">{status.desc}</p>
        </div>
        {project.scoreCard && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">AI 평가 결과</h3>
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {project.scoreCard.totalScore.toFixed(1)}점
            </div>
            {project.autoApproved && (
              <span className="text-xs text-green-600 font-medium">자동 승인</span>
            )}
            <p className="text-sm text-gray-500 mt-3 leading-relaxed">
              {project.scoreCard.evaluationRationale}
            </p>
            {/* Gate 2 기술 표준 */}
            {project.techStandardsPassed !== undefined && (
              <div className={`mt-3 rounded-lg px-3 py-2 text-xs border ${project.techStandardsPassed ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                <span className="font-semibold">Gate 2 기술 표준:</span>{' '}
                {project.techStandardsPassed
                  ? '통과'
                  : `보류 — ${(JSON.parse(project.techStandardsFailedItems || '[]') as string[]).join(', ')}`
                }
              </div>
            )}
          </div>
        )}
        <Link href="/" className="text-sm text-blue-600 hover:underline">← 홈으로</Link>
      </div>
    </main>
  )
}
