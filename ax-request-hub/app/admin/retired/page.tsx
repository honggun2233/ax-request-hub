'use client'
import { useState, useEffect } from 'react'

const DEPRECATION_REASONS = ['DUPLICATE', 'PERFORMANCE', 'POLICY_CHANGE', 'SCOPE_CHANGE', 'OTHER']

const STATUS_BADGE: Record<string, string> = {
  DEPRECATED: 'bg-orange-100 text-orange-700',
  RETIRED: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-100 text-green-700',
}

type Agent = {
  id: string
  name: string
  department: string
  description: string
  status: string
  deprecatedAt?: string
  retiredAt?: string
  deprecationReason?: string
  retirementNote?: string
  successorAgentId?: string
  dataRetentionYears: number
  artifacts?: Artifact[]
  knowledgeExtracts?: KnowledgeExtract[]
}

type Artifact = {
  id: string
  agentId: string
  artifactType: string
  title: string
  contentPath: string
  createdAt: string
  retainUntil: string
  transferredTo?: string
  archived: boolean
}

type KnowledgeExtract = {
  id: string
  agentId: string
  promptPatterns?: string
  failureCases?: string
  useCaseSummary?: string
  lessonsLearned?: string
  extractedBy: string
  extractedAt: string
}

type TabId = 'list' | 'deprecate' | 'artifacts' | 'knowledge'

export default function RetiredAgentsPage() {
  const [tab, setTab] = useState<TabId>('list')
  const [agents, setAgents] = useState<Agent[]>([])
  const [allAgents, setAllAgents] = useState<Agent[]>([])
  const [search, setSearch] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('')
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [knowledge, setKnowledge] = useState<KnowledgeExtract[]>([])
  const [form, setForm] = useState({ reason: '', note: '', successorId: '' })
  const [knowledgeForm, setKnowledgeForm] = useState({
    promptPatterns: '',
    failureCases: '',
    useCaseSummary: '',
    lessonsLearned: '',
  })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/agents/retired')
      .then(r => r.json())
      .then(setAgents)
      .catch(() => {})
    fetch('/api/admin/agents')
      .then(r => r.json())
      .then(setAllAgents)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedAgent) return
    fetch(`/api/agents/${selectedAgent}/artifacts`)
      .then(r => r.json())
      .then(setArtifacts)
      .catch(() => {})
    fetch(`/api/agents/${selectedAgent}/knowledge`)
      .then(r => r.json())
      .then(setKnowledge)
      .catch(() => {})
  }, [selectedAgent])

  const filtered = agents.filter(a =>
    [a.name, a.department, a.deprecationReason ?? '']
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const activeAgents = allAgents.filter(a => a.status === 'ACTIVE')

  const handleDeprecate = async () => {
    if (!selectedAgent || !form.reason) {
      setMsg('에이전트와 폐기사유를 선택하세요.')
      return
    }
    setLoading(true)
    const res = await fetch(`/api/agents/${selectedAgent}/deprecate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deprecationReason: form.reason,
        retirementNote: form.note,
        successorAgentId: form.successorId || undefined,
      }),
    })
    setLoading(false)
    if (res.ok) {
      setMsg('DEPRECATED 상태로 변경됐습니다 (30일 유예 후 RETIRE 가능)')
      const updated = await fetch('/api/agents/retired').then(r => r.json())
      setAgents(updated)
      const all = await fetch('/api/admin/agents').then(r => r.json())
      setAllAgents(all)
    } else {
      const err = await res.json()
      setMsg(`오류: ${err.error}`)
    }
  }

  const handleKnowledgeSave = async () => {
    if (!selectedAgent) {
      setMsg('에이전트를 선택하세요')
      return
    }
    setLoading(true)
    const res = await fetch(`/api/agents/${selectedAgent}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(knowledgeForm),
    })
    setLoading(false)
    if (res.ok) {
      setMsg('지식 추출 저장 완료')
      const updated = await fetch(`/api/agents/${selectedAgent}/knowledge`).then(r => r.json())
      setKnowledge(updated)
      setKnowledgeForm({ promptPatterns: '', failureCases: '', useCaseSummary: '', lessonsLearned: '' })
    } else {
      const err = await res.json()
      setMsg(`오류: ${err.error}`)
    }
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: 'list', label: '폐기 에이전트 목록' },
    { id: 'deprecate', label: '폐기 절차 시작' },
    { id: 'artifacts', label: '산출물 아카이브' },
    { id: 'knowledge', label: '지식 추출' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold">폐기 에이전트 거버넌스</h1>

      {msg && (
        <div className="p-3 rounded bg-blue-50 text-sm text-blue-700 flex justify-between items-center">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-blue-400 hover:text-blue-600 ml-4">x</button>
        </div>
      )}

      <nav className="flex border-b">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'list' && (
        <div className="space-y-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름/부서/폐기사유 검색..."
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div className="grid gap-3">
            {filtered.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">폐기된 에이전트 없음</p>
            )}
            {filtered.map(a => {
              const expiry = a.retiredAt
                ? new Date(
                    new Date(a.retiredAt).setFullYear(
                      new Date(a.retiredAt).getFullYear() + (a.dataRetentionYears || 3)
                    )
                  ).toLocaleDateString('ko-KR')
                : '-'
              return (
                <div key={a.id} className="bg-white border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_BADGE[a.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 grid grid-cols-3 gap-2">
                    <span>부서: {a.department}</span>
                    <span>폐기사유: {a.deprecationReason ?? '-'}</span>
                    <span>보존만료: {expiry}</span>
                  </div>
                  {a.retirementNote && (
                    <p className="text-xs text-gray-400">{a.retirementNote}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'deprecate' && (
        <div className="bg-white border rounded-lg p-6 space-y-4 max-w-lg">
          <h2 className="font-semibold">폐기 절차 시작</h2>
          <div className="p-3 bg-yellow-50 rounded text-sm text-yellow-700">
            DEPRECATED 후 최소 30일 경과 후 RETIRE 가능합니다.
          </div>
          <label className="block text-sm">
            <span className="text-gray-600">대상 에이전트</span>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">선택...</option>
              {activeAgents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.department})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">폐기 사유 *</span>
            <select
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">선택...</option>
              {DEPRECATION_REASONS.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">메모</span>
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={3}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">후속 에이전트 (선택)</span>
            <select
              value={form.successorId}
              onChange={e => setForm(f => ({ ...f, successorId: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">없음</option>
              {allAgents
                .filter(a => a.id !== selectedAgent)
                .map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            onClick={handleDeprecate}
            disabled={loading}
            className="w-full bg-orange-500 text-white py-2 rounded text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? '처리 중...' : '폐기 절차 시작 (DEPRECATED)'}
          </button>
        </div>
      )}

      {tab === 'artifacts' && (
        <div className="space-y-4">
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">에이전트 선택...</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} [{a.status}]
              </option>
            ))}
          </select>
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b font-medium text-sm">
              산출물 목록 (읽기전용)
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['제목', '유형', '보존만료일', '이관상태'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-gray-600 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {artifacts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      산출물 없음
                    </td>
                  </tr>
                ) : (
                  artifacts.map(a => (
                    <tr key={a.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{a.title}</td>
                      <td className="px-4 py-2 text-gray-500">{a.artifactType}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {new Date(a.retainUntil).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-2">
                        {a.archived ? (
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">이관완료</span>
                        ) : (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">보존중</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="space-y-4 max-w-2xl">
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">에이전트 선택...</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} [{a.status}]
              </option>
            ))}
          </select>

          {knowledge.length > 0 && (
            <div className="bg-gray-50 rounded p-4 text-sm space-y-2">
              <p className="font-medium">기존 추출 ({knowledge.length}건)</p>
              {knowledge.map((k, i) => (
                <p key={i} className="text-gray-500">
                  · {new Date(k.extractedAt).toLocaleDateString('ko-KR')} — {k.extractedBy}
                </p>
              ))}
            </div>
          )}

          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold">지식 추출 입력</h2>
            {(
              [
                { key: 'promptPatterns', label: '효과적이었던 프롬프트 패턴' },
                { key: 'failureCases', label: '실패 케이스 요약' },
                { key: 'useCaseSummary', label: '사용 케이스 요약' },
                { key: 'lessonsLearned', label: '배운 점 (Lessons Learned)' },
              ] as { key: keyof typeof knowledgeForm; label: string }[]
            ).map(f => (
              <label key={f.key} className="block text-sm">
                <span className="text-gray-600">{f.label}</span>
                <textarea
                  value={knowledgeForm[f.key]}
                  onChange={e =>
                    setKnowledgeForm(kf => ({ ...kf, [f.key]: e.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono"
                />
              </label>
            ))}
            <button
              onClick={handleKnowledgeSave}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '저장 중...' : '지식 추출 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
