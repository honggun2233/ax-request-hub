import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AppealSection } from '@/components/appeal-section'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  submitted:  { label: '접수됨',     cls: 'bg-slate-100 text-slate-600 border-slate-300' },
  evaluated:  { label: '검토 중',    cls: 'bg-amber-50 text-amber-700 border-amber-300' },
  pilot:      { label: '파일럿 승인', cls: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  production: { label: '운영 중',    cls: 'bg-blue-50 text-blue-700 border-blue-300' },
  closed:     { label: '종료',       cls: 'bg-red-50 text-red-700 border-red-300' },
}

const DR_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT:    { label: '임시저장',  cls: 'text-slate-500 border-slate-300 bg-slate-50' },
  PENDING:  { label: '심사중',   cls: 'text-amber-700 border-amber-300 bg-amber-50' },
  APPROVED: { label: '승인됨',   cls: 'text-emerald-700 border-emerald-300 bg-emerald-50' },
  REJECTED: { label: '반려됨',   cls: 'text-red-700 border-red-300 bg-red-50' },
}

const GATE_STAGES = [
  { key: 'DEVELOPING', label: '개발중' },
  { key: 'GATE1',      label: 'Gate 1' },
  { key: 'GATE2',      label: 'Gate 2' },
  { key: 'GATE3',      label: 'Gate 3' },
  { key: 'ACTIVE',     label: '운영중' },
]

const STAGE_ORDER = ['DEVELOPING', 'GATE1', 'GATE2', 'GATE3', 'ACTIVE']

export default async function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scoreCard: true,
      dataRequests: {
        select: {
          id: true, type: true, classification: true, status: true,
          requestedSpec: true, periodMonths: true, includesPII: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      agentRegistries: {
        select: {
          id: true, agentName: true, lifecycleStage: true,
          gate1Passed: true, gate2Passed: true, gate3Passed: true,
          fallbackRate: true, sam30dAccuracy: true,
        },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!project) notFound()

  const appeals = await prisma.projectAppeal.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'desc' },
  })
  const appealsData = appeals.map(a => ({
    id: a.id, reason: a.reason, evidenceNote: a.evidenceNote, status: a.status,
    reviewNote: a.reviewNote, reviewedBy: a.reviewedBy,
    createdAt: a.createdAt.toISOString(), resolvedAt: a.resolvedAt?.toISOString() ?? null,
  }))

  const status = STATUS_MAP[project.status] ?? STATUS_MAP['submitted']
  const agent = project.agentRegistries?.[0] ?? null
  const isApproved = ['pilot', 'production'].includes(project.status)
  // 반려/종료된 과제에 한해 이의제기 가능
  const canAppeal = project.status === 'closed'

  const pendingDataRequests = project.dataRequests.filter(r => r.status === 'PENDING')
  const hasDataWarning = isApproved && pendingDataRequests.length > 0 && agent?.lifecycleStage === 'GATE2'

  const stageIdx = agent ? STAGE_ORDER.indexOf(agent.lifecycleStage) : -1

  return (
    <div className="min-h-screen" style={{ background: '#F7F9FC', color: '#18243D', fontFamily: 'inherit' }}>
      {/* 헤더 */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E4E9F2', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/me/projects" style={{ fontSize: 12, color: '#8898BB', textDecoration: 'none' }}>← 내 과제 목록</Link>
        <span style={{ color: '#E4E9F2' }}>|</span>
        <span style={{ fontSize: 12, color: '#8898BB', letterSpacing: '.04em' }}>과제 현황</span>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px' }}>

        {/* 과제 헤더 카드 */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E9F2', borderRadius: 8, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, boxShadow: '0 1px 4px rgba(30,53,96,.06)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '.12em', color: '#B8956A', textTransform: 'uppercase', marginBottom: 6 }}>
              AI 활용 과제
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#18243D', margin: 0 }}>{project.title}</h1>
            <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`text-xs font-semibold px-3 py-1 rounded border ${status.cls}`} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, fontWeight: 600 }}>
                {status.label}
              </span>
              <span style={{ fontSize: 12, color: '#8898BB' }}>{project.department} · {project.requesterName}</span>
              <span style={{ fontSize: 12, color: '#8898BB' }}>{new Date(project.createdAt).toLocaleDateString('ko-KR')}</span>
            </div>
          </div>
          {project.scoreCard && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: '#8898BB', marginBottom: 4 }}>자동 심사 점수</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#B8956A', fontFamily: 'monospace', lineHeight: 1 }}>
                {project.scoreCard.totalScore.toFixed(0)}
                <span style={{ fontSize: 14, color: '#8898BB' }}>/100</span>
              </div>
              {project.autoApproved && (
                <div style={{ fontSize: 10, color: '#059669', marginTop: 4 }}>자동 승인</div>
              )}
            </div>
          )}
        </div>

        {/* 데이터 + 에이전트 2열 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* 데이터 승인 현황 */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E9F2', borderRadius: 8, boxShadow: '0 1px 4px rgba(30,53,96,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #E4E9F2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#8898BB', textTransform: 'uppercase' }}>
                <span style={{ width: 3, height: 14, background: '#B8956A', borderRadius: 1, display: 'inline-block' }} />
                데이터 승인 현황
              </div>
              <span style={{ fontSize: 10, color: '#BEC8DC' }}>DATA_PLATFORM 팀 검토</span>
            </div>
            <div style={{ padding: '0 18px' }}>
              {/* Gate2 데이터 미승인 경고 */}
              {hasDataWarning && (
                <div style={{ margin: '12px 0 0', borderLeft: '3px solid #D97706', background: 'rgba(217,119,6,.08)', padding: '8px 12px', borderRadius: '0 4px 4px 0', fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', flexShrink: 0 }} />
                  미승인 데이터가 있습니다. Gate 2 진입 전 확인하세요.
                </div>
              )}

              {project.noDataRequired && project.dataRequests.length === 0 ? (
                <div style={{ padding: '18px 0', fontSize: 13, color: '#8898BB' }}>
                  별도 데이터 불필요로 신청됨
                </div>
              ) : project.dataRequests.length === 0 ? (
                <div style={{ padding: '18px 0', fontSize: 13, color: '#8898BB' }}>
                  데이터 요건 없음
                </div>
              ) : (
                project.dataRequests.map((dr, i) => {
                  const ds = DR_STATUS[dr.status] ?? DR_STATUS['PENDING']
                  return (
                    <div key={dr.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < project.dataRequests.length - 1 ? '1px solid #E4E9F2' : 'none', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, color: '#18243D', marginBottom: 3 }}>
                          {dr.requestedSpec || `데이터 요건 #${i + 1}`}
                        </div>
                        <div style={{ fontSize: 11, color: '#8898BB', display: 'flex', gap: 10 }}>
                          <span>{dr.type === 'NEW' ? 'Track B' : 'Track A'}</span>
                          <span style={{ color: dr.classification === 'CONFIDENTIAL' ? '#B94040' : dr.classification === 'RESTRICTED' ? '#B45309' : '#059669' }}>
                            {dr.classification}
                          </span>
                          <span>{dr.periodMonths}개월</span>
                          {dr.includesPII && <span style={{ color: '#7C3AED' }}>개인정보 포함</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, border: '1px solid', flexShrink: 0, ...Object.fromEntries(Object.entries(ds).filter(([k]) => k === 'cls').flatMap(() => [])) }} className={ds.cls}>
                        {ds.label}
                      </span>
                    </div>
                  )
                })
              )}
              {isApproved && (
                <div style={{ padding: '10px 0' }}>
                  <Link href="/data/requests" style={{ fontSize: 12, color: '#B8956A', textDecoration: 'none' }}>
                    데이터 신청 상세 보기 ›
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* 개발 결과물 */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E9F2', borderRadius: 8, boxShadow: '0 1px 4px rgba(30,53,96,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #E4E9F2', gap: 8 }}>
              <span style={{ width: 3, height: 14, background: '#B8956A', borderRadius: 1, display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#8898BB', textTransform: 'uppercase' }}>
                개발 결과물
              </span>
            </div>
            <div style={{ padding: '16px 18px' }}>
              {!isApproved ? (
                <div style={{ fontSize: 13, color: '#8898BB', padding: '8px 0' }}>
                  과제 승인 후 에이전트를 등록할 수 있습니다.
                </div>
              ) : !agent ? (
                /* CTA 배너 */
                <div style={{ border: '1px dashed rgba(184,149,106,.4)', background: 'rgba(184,149,106,.07)', borderRadius: 6, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#18243D', marginBottom: 4 }}>과제가 승인됐습니다.</div>
                    <div style={{ fontSize: 12, color: '#8898BB' }}>레지스트리에 에이전트를 등록하면 Gate 1부터 라이프사이클 관리가 시작됩니다.</div>
                  </div>
                  <Link href={`/registry?projectId=${project.id}`}
                    style={{ display: 'inline-block', background: '#B8956A', color: '#FFFFFF', fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 6, textDecoration: 'none', alignSelf: 'flex-start' }}>
                    에이전트 등록하기 ›
                  </Link>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#18243D' }}>{agent.agentName}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'rgba(184,149,106,.12)', color: '#B8956A', border: '1px solid rgba(184,149,106,.3)' }}>
                      {GATE_STAGES.find(s => s.key === agent.lifecycleStage)?.label ?? agent.lifecycleStage}
                    </span>
                  </div>

                  {/* Gate 타임라인 */}
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 16, marginBottom: 14 }}>
                    {GATE_STAGES.map((s, i) => {
                      const done   = stageIdx > i
                      const active = stageIdx === i
                      return (
                        <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                          {i > 0 && (
                            <div style={{ position: 'absolute', top: 9, right: '50%', left: '-50%', height: 1, background: done ? 'rgba(184,149,106,.5)' : '#E4E9F2' }} />
                          )}
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%', position: 'relative', zIndex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 700,
                            border: `2px solid ${done ? '#B8956A' : active ? '#B8956A' : '#E4E9F2'}`,
                            background: done ? '#B8956A' : active ? 'rgba(184,149,106,.12)' : '#F7F9FC',
                            color: done ? '#FFFFFF' : active ? '#B8956A' : '#BEC8DC',
                          }}>
                            {done ? '✓' : i + 1}
                          </div>
                          <div style={{ fontSize: 9, marginTop: 4, color: done || active ? '#B8956A' : '#BEC8DC' }}>
                            {s.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* KPI */}
                  {agent.fallbackRate !== null && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8898BB', marginBottom: 4 }}>
                        <span>Fallback율</span>
                        <span style={{ fontFamily: 'monospace', color: (agent.fallbackRate ?? 0) <= 0.3 ? '#059669' : '#D97706' }}>
                          {((agent.fallbackRate ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ height: 4, background: '#E4E9F2', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(agent.fallbackRate ?? 0) * 100}%`, background: (agent.fallbackRate ?? 0) <= 0.3 ? '#059669' : '#D97706', borderRadius: 2 }} />
                      </div>
                    </div>
                  )}
                  {agent.sam30dAccuracy !== null && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8898BB', marginBottom: 4 }}>
                        <span>30일 정확도</span>
                        <span style={{ fontFamily: 'monospace', color: (agent.sam30dAccuracy ?? 0) >= 0.55 ? '#059669' : '#D97706' }}>
                          {((agent.sam30dAccuracy ?? 0) * 100).toFixed(0)}%
                          {agent.lifecycleStage === 'GATE2' && (agent.sam30dAccuracy ?? 0) < 0.55 && (
                            <span style={{ fontSize: 10, color: '#B94040', marginLeft: 4 }}>기준 미달</span>
                          )}
                        </span>
                      </div>
                      <div style={{ height: 4, background: '#E4E9F2', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(agent.sam30dAccuracy ?? 0) * 100}%`, background: (agent.sam30dAccuracy ?? 0) >= 0.55 ? '#059669' : '#D97706', borderRadius: 2 }} />
                      </div>
                    </div>
                  )}

                  <Link href={`/registry?highlight=${agent.id}`}
                    style={{ display: 'block', textAlign: 'center', fontSize: 12, color: '#B8956A', textDecoration: 'none', padding: '8px', border: '1px solid rgba(184,149,106,.3)', borderRadius: 6 }}>
                    레지스트리에서 상세 관리 ›
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 스코어카드 상세 */}
        {project.scoreCard && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E9F2', borderRadius: 8, marginTop: 16, padding: '16px 18px', boxShadow: '0 1px 4px rgba(30,53,96,.05)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#8898BB', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 3, height: 14, background: '#B8956A', borderRadius: 1, display: 'inline-block' }} />
              AI 심사 결과
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { label: '전략 적합성', val: project.scoreCard.strategyScore },
                { label: '기대 효과',  val: project.scoreCard.impactScore },
                { label: 'ROI',        val: project.scoreCard.roiScore },
                { label: '기밀성',     val: project.scoreCard.confidentialityScore },
                { label: '준비도',     val: project.scoreCard.readinessScore },
                { label: '난이도',     val: project.scoreCard.difficultyScore },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: '#F7F9FC', border: '1px solid #E4E9F2', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: '#8898BB', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#B8956A', fontFamily: 'monospace' }}>
                    {val?.toFixed(1) ?? '—'}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: '#8898BB', lineHeight: 1.6 }}>
              {project.scoreCard.evaluationRationale}
            </p>
          </div>
        )}

        {/* 이의제기 */}
        <AppealSection projectId={project.id} appeals={appealsData} canAppeal={canAppeal} />
      </div>
    </div>
  )
}
