'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const LIFECYCLE_STAGES = [
  { key: 'DEVELOPING', label: '개발중',         color: 'bg-gray-100 text-gray-600 border-gray-300' },
  { key: 'GATE1',      label: 'Gate1 QA',       color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'GATE2',      label: 'Gate2 도메인',   color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { key: 'GATE3',      label: 'Gate3 스트레스', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { key: 'ACTIVE',     label: '운영중',          color: 'bg-green-100 text-green-700 border-green-300' },
  { key: 'DEGRADED',   label: '성능저하',        color: 'bg-red-100 text-red-700 border-red-300' },
  { key: 'RETIRED',    label: '폐기',            color: 'bg-gray-100 text-gray-400 border-gray-200' },
]

const DOMAIN_COLOR: Record<string, string> = {
  ETF:    'bg-blue-50 border-blue-200 text-blue-800',
  운영:   'bg-teal-50 border-teal-200 text-teal-800',
  효율화: 'bg-purple-50 border-purple-200 text-purple-800',
  거버넌스:'bg-orange-50 border-orange-200 text-orange-800',
}

const STAGE_ACTIONS: Record<string, { msg: string }> = {
  DEVELOPING: { msg: '개발 중. Gate1 진입 전 단계 — 기능 테스트 80% 이상, 데이터 플로우 다이어그램 작성 후 Gate1 신청.' },
  GATE1:      { msg: 'QA 검증 단계 — fallback율 ≤ 30%, 핵심 기능 정상 반환 확인 중.' },
  GATE2:      { msg: '도메인 리뷰 단계 — 담당 부서의 업무 적합성 검토 및 운용역/현업 신뢰점수 태깅 필요.' },
  GATE3:      { msg: 'QA 스트레스 테스트 단계 — 데이터 없음/이상값 처리 및 장시간 안정성 확인 중.' },
  ACTIVE:     { msg: '정상 운영 중. 주간 KPI 및 fallback율 모니터링.' },
  DEGRADED:   { msg: '⚠ 성능 저하 감지 — 즉시 점검 필요. fallback율 증가 또는 정확도 하락.' },
  RETIRED:    { msg: '폐기 완료. 아카이브에서 이력 확인 가능.' },
}

const NEXT_STAGE: Record<string, string> = {
  DEVELOPING: 'GATE1', GATE1: 'GATE2', GATE2: 'GATE3', GATE3: 'ACTIVE', DEGRADED: 'RETIRED',
}

const ROLE_LABEL: Record<string, string> = {
  PRIMARY:      '주에이전트',
  SUPPORTING:   '보조',
  EXPERIMENTAL: '실험적',
}

function GateBar({ g1, g2, g3 }: { g1: boolean; g2: boolean; g3: boolean }) {
  const dot = (passed: boolean, label: string) => (
    <span key={label} className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${passed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
      {passed ? '✓' : '–'} {label}
    </span>
  )
  return <div className="flex gap-1 mt-2">{dot(g1, 'G1')}{dot(g2, 'G2')}{dot(g3, 'G3')}</div>
}

function FallbackBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  const color = pct <= 30 ? 'bg-green-400' : pct <= 70 ? 'bg-orange-400' : 'bg-red-400'
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Fallback율</span>
        <span className={pct > 70 ? 'text-red-600 font-medium' : ''}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const s = LIFECYCLE_STAGES.find(x => x.key === stage)
  if (!s) return null
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${s.color}`}>{s.label}</span>
}

// ── 슬라이드오버 ───────────────────────────────────────────────
function SlideOver({ agent, allProjects, onClose, onStageChange }: {
  agent: any
  allProjects: any[]
  onClose: () => void
  onStageChange: () => void
}) {
  const [trustScore, setTrustScore] = useState<number>(agent.operatorTrustScore ?? 3)
  const [comment, setComment] = useState<string>(agent.operatorComment ?? '')
  const [saving, setSaving] = useState(false)
  const [linkSaving, setLinkSaving] = useState(false)
  const [addingProject, setAddingProject] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedRole, setSelectedRole] = useState('PRIMARY')

  const linkedProjectIds = new Set((agent.projects ?? []).map((p: any) => p.projectId))
  const unlinkableProjects = allProjects.filter(p => !linkedProjectIds.has(p.id))

  const advanceStage = async (newStage: string) => {
    setSaving(true)
    await fetch('/api/registry', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: agent.id, lifecycleStage: newStage, operatorTrustScore: trustScore, operatorComment: comment }),
    })
    setSaving(false)
    onStageChange()
    onClose()
  }

  const addLink = async () => {
    if (!selectedProjectId) return
    setLinkSaving(true)
    await fetch('/api/registry/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, projectId: selectedProjectId, role: selectedRole }),
    })
    setLinkSaving(false)
    setAddingProject(false)
    setSelectedProjectId('')
    onStageChange()
  }

  const removeLink = async (projectId: string) => {
    await fetch('/api/registry/links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, projectId }),
    })
    onStageChange()
  }

  const nextStage = NEXT_STAGE[agent.lifecycleStage]

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[440px] bg-white shadow-2xl flex flex-col overflow-y-auto border-l">
        <div className="flex items-start justify-between p-5 border-b bg-gray-50">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">{agent.agentName}</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{agent.purpose}</p>
            <div className="mt-2"><StageBadge stage={agent.lifecycleStage} /></div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4 mt-0.5">×</button>
        </div>

        <div className="p-5 space-y-5 flex-1">

          {/* 소속 프로젝트 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">소속 프로젝트</p>
              <button onClick={() => setAddingProject(!addingProject)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                {addingProject ? '취소' : '+ 연결'}
              </button>
            </div>

            {(agent.projects ?? []).length === 0 && !addingProject && (
              <p className="text-xs text-gray-400 italic">연결된 프로젝트 없음</p>
            )}

            <div className="space-y-1.5">
              {(agent.projects ?? []).map((link: any) => (
                <div key={link.projectId}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${DOMAIN_COLOR[link.project?.domain] ?? 'bg-gray-50 border-gray-200'}`}>
                  <div>
                    <span className="font-medium">{link.project?.name}</span>
                    <span className="ml-2 text-xs opacity-60">{ROLE_LABEL[link.role] ?? link.role}</span>
                  </div>
                  <button onClick={() => removeLink(link.projectId)}
                    className="text-gray-400 hover:text-red-500 text-xs ml-2">✕</button>
                </div>
              ))}
            </div>

            {addingProject && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
                <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-blue-300">
                  <option value="">프로젝트 선택...</option>
                  {unlinkableProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>
                  ))}
                </select>
                <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-blue-300">
                  <option value="PRIMARY">주에이전트 (PRIMARY)</option>
                  <option value="SUPPORTING">보조 (SUPPORTING)</option>
                  <option value="EXPERIMENTAL">실험적 (EXPERIMENTAL)</option>
                </select>
                <button onClick={addLink} disabled={!selectedProjectId || linkSaving}
                  className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                  {linkSaving ? '저장 중...' : '연결 추가'}
                </button>
              </div>
            )}
          </div>

          {/* Gate 진행도 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Gate 진행도</p>
            <div className="space-y-2">
              {[
                { label: 'Gate1 — QA 기능 검증',  passed: agent.gate1Passed, at: agent.gate1PassedAt, criteria: 'fallback율 ≤ 30%, AgentSignal 정상' },
                { label: 'Gate2 — 도메인 검증',   passed: agent.gate2Passed, at: agent.gate2PassedAt, criteria: '30일 정확도 ≥ 55%, 신뢰점수 ≥ 3' },
                { label: 'Gate3 — 스트레스 검증', passed: agent.gate3Passed, at: agent.gate3PassedAt, criteria: '이상값/데이터없음 시 크래시 0' },
              ].map(g => (
                <div key={g.label} className={`rounded-lg px-3 py-2.5 ${g.passed ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${g.passed ? 'text-green-700' : 'text-gray-400'}`}>{g.passed ? '✓' : '○'}</span>
                    <span className={`text-sm ${g.passed ? 'text-green-900' : 'text-gray-500'}`}>{g.label}</span>
                    {g.at && (
                      <span className="ml-auto text-xs text-gray-400">{new Date(g.at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 ml-5">{g.criteria}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 주요 지표 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">주요 지표</p>
            <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
              {[
                { label: '데이터소스',    value: agent.dataSource },
                { label: '실데이터 연결', value: agent.realDataConnected ? '연결됨' : 'Mock 사용' },
                { label: 'Fallback율',    value: `${Math.round(agent.fallbackRate * 100)}%`, warn: agent.fallbackRate > 0.7 },
                { label: '30일 정확도',  value: agent.sam30dAccuracy != null ? `${Math.round(agent.sam30dAccuracy * 100)}%` : '측정 중' },
                { label: '최근 Score',    value: agent.scores?.[0]?.score?.toFixed(1) ?? '없음' },
              ].map(row => (
                <div key={row.label} className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={`font-medium ${'warn' in row && row.warn ? 'text-red-600' : 'text-gray-900'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gate2 운용역 리뷰 */}
          {agent.lifecycleStage === 'GATE2' && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">운용역 리뷰 태깅</p>
              <div className="space-y-3 bg-orange-50 rounded-lg p-3 border border-orange-100">
                <div>
                  <label className="text-xs text-gray-600 font-medium">신뢰점수 (1=불신 / 5=매우신뢰)</label>
                  <div className="flex gap-1.5 mt-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setTrustScore(n)}
                        className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${trustScore === n ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:border-orange-300'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium">코멘트 (선택)</label>
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="도메인 관점 의견을 남겨주세요"
                    className="mt-1 w-full text-sm border border-gray-200 rounded-lg p-2 h-20 resize-none text-gray-700 focus:outline-none focus:border-orange-300" />
                </div>
              </div>
            </div>
          )}

          {agent.notes && (
            <div className="text-xs text-gray-600 bg-yellow-50 rounded-lg p-3 border border-yellow-100 leading-relaxed">📝 {agent.notes}</div>
          )}
        </div>

        {(nextStage || agent.lifecycleStage === 'GATE3') && (
          <div className="p-4 border-t bg-gray-50 space-y-2">
            {nextStage && nextStage !== 'ACTIVE' && (
              <button disabled={saving} onClick={() => advanceStage(nextStage)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? '저장 중...' : `→ ${LIFECYCLE_STAGES.find(s => s.key === nextStage)?.label} 로 진행`}
              </button>
            )}
            {agent.lifecycleStage === 'GATE3' && (
              <button disabled={saving} onClick={() => advanceStage('ACTIVE')}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
                {saving ? '저장 중...' : '✓ ACTIVE 전환 (Gate3 통과)'}
              </button>
            )}
            {!['ACTIVE', 'RETIRED'].includes(agent.lifecycleStage) && (
              <button onClick={() => advanceStage('RETIRED')}
                className="w-full py-2 border border-red-200 text-red-500 rounded-lg text-xs hover:bg-red-50 transition-colors">
                폐기 처리 (RETIRED)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 에이전트 등록 모달 ────────────────────────────────────────
function RegisterModal({
  approvedProjects,
  defaultProjectId,
  onClose,
  onCreated,
}: {
  approvedProjects: any[]
  defaultProjectId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    agentName: '',
    agentKey: '',
    purpose: '',
    dataSource: '',
    projectId: defaultProjectId,
    lifecycleStage: 'DEVELOPING',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.projectId) { setError('승인된 과제를 선택하세요.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? '등록 오류')
      }
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
          <div>
            <h2 className="font-semibold text-gray-900">에이전트 등록</h2>
            <p className="text-xs text-gray-500 mt-0.5">승인된 AI 활용 과제와 연결 필수 (Q2)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* 승인 과제 선택 — 필수 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              연결 과제 <span className="text-red-500">*</span>
              <span className="ml-1 text-gray-400 font-normal">(승인된 과제만 표시)</span>
            </label>
            {approvedProjects.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-700">
                승인된 과제가 없습니다.{' '}
                <Link href="/me/projects" className="underline font-medium">과제 목록</Link>에서 먼저 과제를 신청하세요.
              </div>
            ) : (
              <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
                required className={inputCls}>
                <option value="">-- 과제 선택 --</option>
                {approvedProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.status === 'pilot' ? '파일럿승인' : '운영중'}] {p.title} · {p.department}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">에이전트 이름 <span className="text-red-500">*</span></label>
            <input type="text" required value={form.agentName}
              onChange={e => setForm({ ...form, agentName: e.target.value })}
              placeholder="예: ETF-Rebalance-Agent" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">에이전트 키 (영문소문자·하이픈) <span className="text-red-500">*</span></label>
            <input type="text" required value={form.agentKey}
              onChange={e => setForm({ ...form, agentKey: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              placeholder="etf-rebalance-agent" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">목적·기능 설명 <span className="text-red-500">*</span></label>
            <textarea required value={form.purpose}
              onChange={e => setForm({ ...form, purpose: e.target.value })}
              rows={2} placeholder="에이전트가 하는 일을 1~2문장으로 설명하세요"
              className={inputCls + ' resize-none'} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">데이터 소스</label>
            <input type="text" value={form.dataSource}
              onChange={e => setForm({ ...form, dataSource: e.target.value })}
              placeholder="예: KRX API, 내부 DB, Mock" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">시작 라이프사이클 단계</label>
            <select value={form.lifecycleStage} onChange={e => setForm({ ...form, lifecycleStage: e.target.value })}
              className={inputCls}>
              <option value="DEVELOPING">DEVELOPING (개발중)</option>
              <option value="GATE1">GATE1 (QA 검증)</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="pt-1 flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={saving || approvedProjects.length === 0}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
              {saving ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 프로젝트 뷰 ──────────────────────────────────────────────
function ProjectView({ projects, onAgentClick }: { projects: any[]; onAgentClick: (agent: any) => void }) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(projects.map(p => p.key)))

  const toggle = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (projects.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">프로젝트 데이터 없음</div>
  }

  return (
    <div className="space-y-3">
      {projects.map(project => {
        const isExpanded = expandedKeys.has(project.key)
        const agents = project.agents ?? []
        const activeCnt  = agents.filter((l: any) => l.agent?.lifecycleStage === 'ACTIVE').length
        const gate2Cnt   = agents.filter((l: any) => l.agent?.lifecycleStage === 'GATE2').length
        const domainClass = DOMAIN_COLOR[project.domain] ?? 'bg-gray-50 border-gray-200 text-gray-800'

        return (
          <div key={project.key} className="bg-white border rounded-xl overflow-hidden">
            {/* 프로젝트 헤더 */}
            <button onClick={() => toggle(project.key)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${domainClass}`}>{project.domain}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{project.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{project.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <div className="text-right text-xs text-gray-500">
                  <div className="font-medium text-gray-900">{agents.length}개 에이전트</div>
                  <div>운영 {activeCnt} · Gate2 {gate2Cnt}</div>
                </div>
                <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* 에이전트 목록 */}
            {isExpanded && (
              <div className="border-t divide-y divide-gray-50">
                {agents.length === 0 ? (
                  <p className="text-xs text-gray-400 px-5 py-3 italic">연결된 에이전트 없음</p>
                ) : (
                  agents.map((link: any) => {
                    const agent = link.agent
                    if (!agent) return null
                    const isRetired = agent.lifecycleStage === 'RETIRED'
                    return (
                      <button key={link.id} onClick={() => !isRetired && onAgentClick(agent)}
                        disabled={isRetired}
                        className={`w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors text-left ${isRetired ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{agent.agentName}</p>
                            <span className="text-xs text-gray-400 flex-shrink-0">{ROLE_LABEL[link.role] ?? link.role}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{agent.purpose}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <GateBar g1={agent.gate1Passed} g2={agent.gate2Passed} g3={agent.gate3Passed} />
                          <StageBadge stage={agent.lifecycleStage} />
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function RegistryPage() {
  const searchParams = useSearchParams()
  const defaultProjectId = searchParams.get('projectId') ?? ''
  const highlightAgentId = searchParams.get('highlight') ?? ''

  const [agentData, setAgentData] = useState<{ agents: any[]; stageCounts: Record<string, number> }>({ agents: [], stageCounts: {} })
  const [projects, setProjects] = useState<any[]>([])
  const [approvedProjects, setApprovedProjects] = useState<any[]>([])
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null)
  const [viewMode, setViewMode] = useState<'agent' | 'project'>('agent')
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(!!defaultProjectId)

  const load = useCallback(async () => {
    try {
      const [regRes, projRes, myProjRes] = await Promise.all([
        fetch('/api/registry'),
        fetch('/api/ax-projects'),
        fetch('/api/projects'),
      ])
      const regJson  = await regRes.json()
      const projJson = await projRes.json()
      const myProj   = await myProjRes.json()
      setAgentData(regJson)
      setProjects(projJson.projects ?? [])
      // 승인된 과제만 필터 (pilot | production)
      const approved = Array.isArray(myProj)
        ? myProj.filter((p: any) => ['pilot', 'production'].includes(p.status))
        : []
      setApprovedProjects(approved)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = selectedStage ? agentData.agents.filter(a => a.lifecycleStage === selectedStage) : agentData.agents
  const stageAction = selectedStage ? STAGE_ACTIONS[selectedStage] : null

  // 슬라이드오버에서 에이전트 클릭 시 최신 데이터 사용
  const openAgent = (agent: any) => {
    const fresh = agentData.agents.find(a => a.id === agent.id) ?? agent
    setSelectedAgent(fresh)
  }

  // highlight: ?projectId 경유로 들어온 에이전트 자동 열기
  useEffect(() => {
    if (highlightAgentId && agentData.agents.length > 0) {
      const target = agentData.agents.find(a => a.id === highlightAgentId)
      if (target) setSelectedAgent(target)
    }
  }, [highlightAgentId, agentData.agents])

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">에이전트 레지스트리</h1>
          <p className="text-sm text-gray-500 mt-0.5">전사 AI 에이전트 라이프사이클 관리 — DEVELOPING → GATE1 → GATE2 → GATE3 → ACTIVE</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="font-medium text-gray-900">총 {agentData.agents.length}개</div>
            <div className="text-gray-500">활성 {agentData.stageCounts['ACTIVE'] ?? 0}개</div>
          </div>
          {/* 에이전트 등록 버튼 */}
          <button
            onClick={() => setShowRegister(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            + 에이전트 등록
          </button>
          {/* 뷰 전환 탭 */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('agent')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'agent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              에이전트 뷰
            </button>
            <button onClick={() => setViewMode('project')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'project' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              프로젝트 뷰
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">로딩 중...</div>
      ) : viewMode === 'agent' ? (
        <>
          {/* 라이프사이클 파이프라인 바 */}
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">라이프사이클 단계 (클릭 → 필터)</p>
            <div className="flex items-stretch gap-1 flex-wrap">
              {LIFECYCLE_STAGES.map((s, i) => {
                const count = agentData.stageCounts[s.key] ?? 0
                const isSelected = selectedStage === s.key
                const needsAttention = (s.key === 'GATE2' && count > 5) || (s.key === 'DEGRADED' && count > 0)
                return (
                  <div key={s.key} className="flex items-center">
                    <button
                      onClick={() => setSelectedStage(isSelected ? null : s.key)}
                      disabled={count === 0}
                      className={`flex flex-col items-center px-4 py-2.5 rounded-lg border text-center transition-all min-w-[80px] ${
                        count === 0
                          ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-default'
                          : isSelected
                          ? `${s.color} ring-2 ring-offset-1 ring-blue-500 shadow-sm`
                          : `${s.color} hover:shadow-sm cursor-pointer`
                      }`}>
                      <span className="text-xs opacity-70 font-medium">{s.label}</span>
                      <span className="text-2xl font-bold leading-tight mt-0.5">{count}</span>
                      {needsAttention && <span className="text-xs mt-0.5 opacity-80">⚠ 필요</span>}
                    </button>
                    {i < LIFECYCLE_STAGES.length - 1 && (
                      <span className="text-gray-200 mx-1 text-lg">→</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 액션 배너 */}
          {stageAction && (
            <div className={`rounded-xl border p-4 ${selectedStage === 'DEGRADED' ? 'bg-red-50 border-red-200' : selectedStage === 'GATE2' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {LIFECYCLE_STAGES.find(s => s.key === selectedStage)?.label} — {agentData.stageCounts[selectedStage ?? ''] ?? 0}개 에이전트
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{stageAction.msg}</p>
            </div>
          )}

          {/* 에이전트 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(agent => {
              const isRetired  = agent.lifecycleStage === 'RETIRED'
              const isDegraded = agent.lifecycleStage === 'DEGRADED'
              const borderClass = isDegraded ? 'border-red-200 bg-red-50/30' :
                agent.lifecycleStage === 'ACTIVE'  ? 'border-green-200' :
                agent.lifecycleStage === 'GATE2'   ? 'border-orange-200' : 'border-gray-200'
              const agentProjects = agent.projects ?? []
              return (
                <button key={agent.id} onClick={() => !isRetired && openAgent(agent)}
                  className={`bg-white border rounded-xl p-4 text-left transition-all group ${borderClass} ${isRetired ? 'opacity-40 cursor-default' : 'hover:shadow-md cursor-pointer'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition-colors leading-tight">
                      {isDegraded && '⚠ '}{agent.agentName}
                    </p>
                    <StageBadge stage={agent.lifecycleStage} />
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{agent.purpose}</p>
                  {/* 소속 프로젝트 태그 */}
                  {agentProjects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agentProjects.map((link: any) => (
                        <span key={link.projectId}
                          className={`text-xs px-1.5 py-0.5 rounded border font-medium ${DOMAIN_COLOR[link.project?.domain] ?? 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                          {link.project?.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <GateBar g1={agent.gate1Passed} g2={agent.gate2Passed} g3={agent.gate3Passed} />
                  <FallbackBar rate={agent.fallbackRate} />
                  <div className="mt-2 flex justify-between text-xs text-gray-400">
                    <span className="truncate max-w-[140px]">{agent.dataSource.split(' ')[0]}</span>
                    <span className={agent.realDataConnected ? 'text-green-500' : 'text-gray-300'}>
                      {agent.realDataConnected ? '✓ 실데이터' : '○ Mock'}
                    </span>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-16 text-gray-400 text-sm">
                {selectedStage ? `${LIFECYCLE_STAGES.find(s => s.key === selectedStage)?.label} 단계 에이전트 없음` : '에이전트 없음'}
              </div>
            )}
          </div>
        </>
      ) : (
        <ProjectView projects={projects} onAgentClick={openAgent} />
      )}

      {selectedAgent && (
        <SlideOver
          agent={selectedAgent}
          allProjects={projects}
          onClose={() => setSelectedAgent(null)}
          onStageChange={load}
        />
      )}

      {showRegister && (
        <RegisterModal
          approvedProjects={approvedProjects}
          defaultProjectId={defaultProjectId}
          onClose={() => setShowRegister(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
