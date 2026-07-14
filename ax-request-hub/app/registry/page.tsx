'use client'
import { useState, useEffect } from 'react'

const LIFECYCLE_STAGES = [
  { key: 'DEVELOPING', label: '개발중',         color: 'bg-gray-100 text-gray-600 border-gray-300' },
  { key: 'GATE1',      label: 'Gate1 QA',       color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'GATE2',      label: 'Gate2 도메인',   color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { key: 'GATE3',      label: 'Gate3 스트레스', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { key: 'ACTIVE',     label: '운영중',          color: 'bg-green-100 text-green-700 border-green-300' },
  { key: 'DEGRADED',   label: '성능저하',        color: 'bg-red-100 text-red-700 border-red-300' },
  { key: 'RETIRED',    label: '폐기',            color: 'bg-gray-100 text-gray-400 border-gray-200' },
]

const STAGE_ACTIONS: Record<string, { msg: string; buttons: { label: string; action?: string }[] }> = {
  DEVELOPING: { msg: 'CTO에 Gate1 테스트 요청 대기 중. PR 머지 후 fallback율 측정 필요.', buttons: [{ label: 'GitHub 이슈 생성' }] },
  GATE1:      { msg: 'QA가 fallback율 ≤ 30%, AgentSignal 정상 반환 검증 중.', buttons: [{ label: '테스트 결과 업로드' }] },
  GATE2:      { msg: '운용역 도메인 리뷰 필요 — SAM LAB 30일 데이터 누적 후 신뢰점수 태깅. 누적 시작 2026-07-14, 측정 가능일 2026-08-13.', buttons: [{ label: 'SAM LAB 열기', action: 'samlab' }, { label: '신뢰점수 태깅' }] },
  GATE3:      { msg: 'QA 스트레스 테스트 실행 필요. 데이터 없음/이상값 시 크래시 0 확인.', buttons: [{ label: '스트레스 테스트 실행' }] },
  ACTIVE:     { msg: '정상 운영 중. 주간 score 및 fallback율 모니터링.', buttons: [{ label: 'SAM LAB 열기', action: 'samlab' }] },
  DEGRADED:   { msg: '⚠ 성능 저하 감지 — 즉시 점검 필요. fallback율 증가 또는 정확도 하락.', buttons: [{ label: '개선 이슈 생성' }, { label: 'SAM LAB 열기', action: 'samlab' }] },
  RETIRED:    { msg: '폐기 완료. 아카이브에서 이력 확인 가능.', buttons: [] },
}

const NEXT_STAGE: Record<string, string> = {
  DEVELOPING: 'GATE1', GATE1: 'GATE2', GATE2: 'GATE3', GATE3: 'ACTIVE', DEGRADED: 'RETIRED',
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

function SlideOver({ agent, onClose, onStageChange }: { agent: any; onClose: () => void; onStageChange: () => void }) {
  const [trustScore, setTrustScore] = useState<number>(agent.operatorTrustScore ?? 3)
  const [comment, setComment] = useState<string>(agent.operatorComment ?? '')
  const [saving, setSaving] = useState(false)

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

  const nextStage = NEXT_STAGE[agent.lifecycleStage]

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[420px] bg-white shadow-2xl flex flex-col overflow-y-auto border-l">
        <div className="flex items-start justify-between p-5 border-b bg-gray-50">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">{agent.agentName}</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{agent.purpose}</p>
            <div className="mt-2"><StageBadge stage={agent.lifecycleStage} /></div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4 mt-0.5">×</button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          {/* Gate 진행도 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Gate 진행도</p>
            <div className="space-y-2">
              {[
                { label: 'Gate1 — QA 기능 검증',  passed: agent.gate1Passed, at: agent.gate1PassedAt, criteria: 'fallback율 ≤ 30%, AgentSignal 정상' },
                { label: 'Gate2 — 도메인 검증',   passed: agent.gate2Passed, at: agent.gate2PassedAt, criteria: 'SAM LAB 30일 정확도 ≥ 55%, 신뢰점수 ≥ 3' },
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
                { label: '30일 정확도',  value: agent.sam30dAccuracy != null ? `${Math.round(agent.sam30dAccuracy * 100)}%` : '측정 중 (30일 필요)' },
                { label: '최근 Score',    value: agent.scores?.[0]?.score?.toFixed(1) ?? '없음' },
              ].map(row => (
                <div key={row.label} className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={`font-medium ${'warn' in row && row.warn ? 'text-red-600' : 'text-gray-900'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gate2 운용역 리뷰 입력 */}
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
            {nextStage && (
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

export default function RegistryPage() {
  const [data, setData] = useState<{ agents: any[]; stageCounts: Record<string, number> }>({ agents: [], stageCounts: {} })
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await fetch('/api/registry')
      const json = await res.json()
      setData(json)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = selectedStage ? data.agents.filter(a => a.lifecycleStage === selectedStage) : data.agents
  const stageAction = selectedStage ? STAGE_ACTIONS[selectedStage] : null

  const handleBannerButton = (action?: string) => {
    if (action === 'samlab') window.open('http://localhost:8601', '_blank')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ETF 에이전트 레지스트리</h1>
          <p className="text-sm text-gray-500 mt-0.5">라이프사이클 기반 관리 — DEVELOPING → GATE1 → GATE2 → GATE3 → ACTIVE</p>
        </div>
        <div className="text-right text-sm">
          <div className="font-medium text-gray-900">총 {data.agents.length}개</div>
          <div className="text-gray-500">활성 {data.stageCounts['ACTIVE'] ?? 0}개</div>
        </div>
      </div>

      {/* 라이프사이클 파이프라인 바 */}
      <div className="bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">라이프사이클 단계 (클릭 → 필터)</p>
        <div className="flex items-stretch gap-1 flex-wrap">
          {LIFECYCLE_STAGES.map((s, i) => {
            const count = data.stageCounts[s.key] ?? 0
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {LIFECYCLE_STAGES.find(s => s.key === selectedStage)?.label} — {data.stageCounts[selectedStage ?? ''] ?? 0}개 에이전트
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{stageAction.msg}</p>
            </div>
            {stageAction.buttons.length > 0 && (
              <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                {stageAction.buttons.map(btn => (
                  <button key={btn.label} onClick={() => handleBannerButton(btn.action)}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 whitespace-nowrap shadow-sm transition-colors">
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 에이전트 카드 그리드 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">로딩 중...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(agent => {
            const isRetired = agent.lifecycleStage === 'RETIRED'
            const isDegraded = agent.lifecycleStage === 'DEGRADED'
            const borderClass = isDegraded ? 'border-red-200 bg-red-50/30' :
              agent.lifecycleStage === 'ACTIVE'  ? 'border-green-200' :
              agent.lifecycleStage === 'GATE2'   ? 'border-orange-200' : 'border-gray-200'
            return (
              <button key={agent.id} onClick={() => !isRetired && setSelectedAgent(agent)}
                className={`bg-white border rounded-xl p-4 text-left transition-all group ${borderClass} ${isRetired ? 'opacity-40 cursor-default' : 'hover:shadow-md cursor-pointer'}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition-colors leading-tight">
                    {isDegraded && '⚠ '}{agent.agentName}
                  </p>
                  <StageBadge stage={agent.lifecycleStage} />
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{agent.purpose}</p>
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
      )}

      {selectedAgent && (
        <SlideOver agent={selectedAgent} onClose={() => setSelectedAgent(null)} onStageChange={load} />
      )}
    </div>
  )
}
