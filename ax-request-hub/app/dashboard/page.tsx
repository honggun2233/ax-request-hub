import Link from 'next/link'
import { db } from '@/src/lib/db'
import { ApproveButtons } from './ApproveButtons'

const CARD  = '#1E293B'
const BDR   = '#334155'
const GOLD  = '#3B82F6'
const TEXT  = '#F1F5F9'
const MUTED = '#94A3B8'

const STATUS_CONFIG: Record<string, { label: string; color: string; stripe: string }> = {
  submitted:  { label: '접수',   color: MUTED,     stripe: '#475569' },
  evaluated:  { label: '검토 중', color: '#F59E0B', stripe: '#F59E0B' },
  pilot:      { label: '파일럿', color: '#34D399',  stripe: '#10B981' },
  production: { label: '운영',   color: '#10B981',  stripe: '#059669' },
  closed:     { label: '종료',   color: '#F87171',  stripe: '#EF4444' },
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
    <div style={{ color: TEXT }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#EBF0F5', margin: 0 }}>AI 활용 포트폴리오</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>총 {projects.length}개 AI 활용 신청</p>
        </div>
        <Link href="/projects/new" style={{
          fontSize: 13, fontWeight: 600, color: '#ffffff',
          background: GOLD, padding: '8px 16px', borderRadius: 4, textDecoration: 'none',
        }}>
          + AI 활용 신청
        </Link>
      </div>

      {/* 칸반 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {STATUS_ORDER.map((status) => {
          const cfg   = STATUS_CONFIG[status]
          const items = byStatus[status] ?? []
          return (
            <div key={status}>
              {/* 컬럼 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span style={{ width: 3, height: 14, background: cfg.stripe, borderRadius: 1, display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  {cfg.label}
                </span>
                <span style={{ fontSize: 11, color: MUTED, marginLeft: 2 }}>({items.length})</span>
              </div>

              {/* 카드들 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((project) => (
                  <div key={project.id} style={{
                    background: CARD, border: `1px solid ${BDR}`, borderRadius: 4, padding: '12px 14px',
                    borderLeft: `3px solid ${cfg.stripe}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontSize: 12, fontWeight: 600, color: '#EBF0F5', lineHeight: 1.4, margin: 0 }}>
                        {project.title}
                      </h3>
                      <span style={{ fontSize: 9, fontWeight: 700, color: MUTED, background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 2, flexShrink: 0 }}>
                        {project.confidentialityLevel}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>{project.department}</p>
                    {project.scoreCard && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, fontFamily: 'monospace', marginBottom: 8 }}>
                        {project.scoreCard.totalScore.toFixed(1)}점
                        {project.autoApproved && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: '#7EB88A', fontWeight: 400 }}>(자동승인)</span>
                        )}
                      </div>
                    )}
                    {project.status === 'evaluated' && (
                      <div style={{ marginBottom: 6 }}>
                        <ApproveButtons projectId={project.id} />
                      </div>
                    )}
                    <Link href={`/status/${project.id}`} style={{ fontSize: 11, color: GOLD, textDecoration: 'none' }}>
                      상세 보기 ›
                    </Link>
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{ fontSize: 11, color: '#3D5A80', textAlign: 'center', padding: '16px 0', border: `1px dashed #2E456A`, borderRadius: 4 }}>
                    없음
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
