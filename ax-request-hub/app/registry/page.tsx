'use client'

import { useEffect, useState } from 'react'

interface Agent {
  id: string
  agentName: string
  agentKey: string
  version: string
  purpose: string
  dataSource: string
  status: string
  realDataConnected: boolean
  fallbackRate: number
  gate1Passed: boolean
  gate2Passed: boolean
  gate3Passed: boolean
  notes?: string
}

export default function RegistryPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [filter, setFilter] = useState<'all' | 'real' | 'mock'>('all')

  useEffect(() => {
    fetch('/api/registry').then(r => r.json()).then(setAgents)
  }, [])

  const filtered = agents.filter(a => {
    if (filter === 'real') return a.realDataConnected
    if (filter === 'mock') return !a.realDataConnected
    return true
  })

  const total = agents.length
  const realCount = agents.filter(a => a.realDataConnected).length
  const gate2Count = agents.filter(a => a.gate2Passed).length
  const avgFallback = agents.length
    ? Math.round((agents.reduce((s, a) => s + a.fallbackRate, 0) / agents.length) * 100)
    : 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">에이전트 레지스트리</h1>
        <p className="text-sm text-gray-500 mt-1">ETF 앙상블 에이전트 거버넌스 현황</p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-3xl font-bold text-gray-900">{total}</div>
          <div className="text-sm text-gray-500 mt-1">전체 에이전트</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-3xl font-bold text-green-600">{realCount}</div>
          <div className="text-sm text-gray-500 mt-1">실데이터 연결</div>
          <div className="text-xs text-gray-400">{total - realCount}개 Mock</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-3xl font-bold text-blue-600">{gate2Count}</div>
          <div className="text-sm text-gray-500 mt-1">Gate2 통과</div>
          <div className="text-xs text-gray-400">도메인 리뷰 완료</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-3xl font-bold text-red-500">{avgFallback}%</div>
          <div className="text-sm text-gray-500 mt-1">평균 Fallback율</div>
          <div className="text-xs text-gray-400">낮을수록 실데이터 의존</div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {(['all', 'real', 'mock'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? '전체' : f === 'real' ? '실연결' : 'Mock'}
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-400 self-center">{filtered.length}개</span>
      </div>

      {/* 에이전트 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(agent => (
          <div key={agent.id} className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-gray-900 text-sm">{agent.agentName}</div>
                <div className="text-xs text-gray-500 mt-0.5">v{agent.version}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                agent.realDataConnected
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {agent.realDataConnected ? '실연결' : 'Mock'}
              </span>
            </div>

            <p className="text-xs text-gray-600 mb-2">{agent.purpose}</p>
            <p className="text-xs text-gray-400 mb-3 font-mono truncate">{agent.dataSource}</p>

            {/* Gate 뱃지 */}
            <div className="flex gap-1.5 mb-3">
              {[1, 2, 3].map(g => {
                const passed = g === 1 ? agent.gate1Passed : g === 2 ? agent.gate2Passed : agent.gate3Passed
                const label = g === 1 ? '기능' : g === 2 ? '도메인' : '스트레스'
                return (
                  <span key={g} className={`text-xs px-1.5 py-0.5 rounded ${
                    passed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    G{g} {label}
                  </span>
                )
              })}
            </div>

            {/* Fallback율 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Fallback율</span>
                <span className={agent.fallbackRate > 0.7 ? 'text-red-500 font-medium' : 'text-gray-600'}>
                  {Math.round(agent.fallbackRate * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    agent.fallbackRate > 0.7 ? 'bg-red-400' :
                    agent.fallbackRate > 0.4 ? 'bg-orange-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${agent.fallbackRate * 100}%` }}
                />
              </div>
            </div>

            {agent.notes && (
              <p className="text-xs text-gray-400 mt-2 italic">{agent.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
