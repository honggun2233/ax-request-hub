'use client'
import { useEffect, useState } from 'react'

type KPI = {
  activeAgents: number
  totalAgents: number
  productionProjects: number
  totalProjects: number
  avgScore: number
  totalCostKrw: number
  totalTokens: number
  activationRate: number
}
type GateItem = { stage: string; count: number }
type AXProject = {
  id: string
  name: string
  status: string
  totalAgents: number
  activeAgents: number
  gate3Agents: number
  gate2Agents: number
  gate1Agents: number
}
type AuditLog = { id: string; action: string; entityType: string; detail: string; createdAt: string }
type LevelItem = { level: string; count: number }
type MonthlyCost = { month: string; cost: number; tokens: number }
type ProjectFunnel = { status: string; count: number }

type DashboardData = {
  kpi: KPI
  gateFunnel: GateItem[]
  axProjects: AXProject[]
  auditLogs: AuditLog[]
  levelDistribution: LevelItem[]
  monthlyCost: MonthlyCost[]
  projectFunnel: ProjectFunnel[]
}

const GATE_LABEL: Record<string, string> = {
  DEVELOPING: '개발중',
  GATE1: 'Gate 1',
  GATE2: 'Gate 2',
  GATE3: 'Gate 3',
  ACTIVE: '운영',
  DEPRECATED: '사용중단',
  RETIRED: '퇴역',
}

const GATE_COLOR: Record<string, string> = {
  DEVELOPING: 'bg-gray-200 text-gray-700',
  GATE1: 'bg-yellow-100 text-yellow-800',
  GATE2: 'bg-blue-100 text-blue-800',
  GATE3: 'bg-purple-100 text-purple-800',
  ACTIVE: 'bg-green-100 text-green-800',
}

const STATUS_LABEL: Record<string, string> = {
  submitted: '접수',
  evaluated: '검토',
  pilot: '파일럿',
  production: '운영',
  closed: '종료',
}

const STATUS_COLOR: Record<string, string> = {
  submitted: 'bg-gray-100 text-gray-700',
  evaluated: 'bg-yellow-100 text-yellow-700',
  pilot: 'bg-blue-100 text-blue-700',
  production: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-700',
}

const AUDIT_LABEL: Record<string, string> = {
  AGENT_RETIRED: '에이전트 퇴역',
  AGENT_DEPRECATED: '에이전트 사용중단',
  LEVEL_REJECTED: '레벨 신청 반려',
  LEVEL_APPROVED: '레벨 신청 승인',
  AGENT_PROMOTED: '에이전트 단계 승진',
  PROJECT_APPROVED: 'AI 활용 승인',
  PROJECT_REJECTED: 'AI 활용 반려',
}

function KpiCard({
  label, value, sub, accent,
}: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm kpi-animate">
      <p className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-widest mb-2">{label}</p>
      <p className="text-3xl font-bold text-[#0B1F3A]">{value}</p>
      {sub && <p className="text-[11px] text-[#94A3B8] mt-1.5">{sub}</p>}
      {accent && <div className="mt-3 h-0.5 rounded-full" style={{ background: `${accent}25` }}><div className="h-0.5 rounded-full w-2/3" style={{ background: accent }} /></div>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest mb-3 flex items-center gap-2">
      <span className="w-0.5 h-4 bg-[#C8A84B] rounded-full inline-block" />
      {children}
    </h2>
  )
}

export default function ExecutiveDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/executive')
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`)
        return json as DashboardData
      })
      .then(setData)
      .catch((e) => setError(String(e)))
  }, [])

  if (error) return <div className="text-red-500 p-8">데이터 로드 실패: {error}</div>
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span>경영진 대시보드 로딩 중...</span>
        </div>
      </div>
    )
  }

  const { kpi, gateFunnel, axProjects, auditLogs, levelDistribution, monthlyCost, projectFunnel } = data
  const maxGate = Math.max(...gateFunnel.map((g) => g.count), 1)
  const maxCost = Math.max(...monthlyCost.map((m) => m.cost), 1)
  const totalEmployees = levelDistribution.reduce((s, l) => s + l.count, 0)

  return (
    <div className="space-y-8 pb-12">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#0B1F3A]">경영진 AI 현황</h1>
          <p className="text-sm text-[#94A3B8] mt-0.5">
            삼성자산운용 AX 포트폴리오 · {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          실시간
        </span>
      </div>

      {/* KPI 타일 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="운영 에이전트"    value={kpi.activeAgents}                           sub={`전체 ${kpi.totalAgents}개 중`}           accent="#10B981" />
        <KpiCard label="AI 활용"           value={kpi.productionProjects}                     sub={`전체 ${kpi.totalProjects}건`}            accent="#3B82F6" />
        <KpiCard label="평균 타당성 점수" value={`${kpi.avgScore}점`}                        sub="6개 항목 가중 평균"                         accent={kpi.avgScore >= 70 ? '#10B981' : '#F59E0B'} />
        <KpiCard label="누적 AI 비용"     value={`₩${kpi.totalCostKrw.toLocaleString()}`}   sub={`${(kpi.totalTokens / 10000).toFixed(0)}만 토큰`} accent="#C8A84B" />
      </div>

      {/* 에이전트 Gate 퍼널 + AI 활용 파이프라인 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gate 퍼널 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>에이전트 Gate 파이프라인</SectionTitle>
          <p className="text-xs text-gray-400 mb-4">
            활성화율 <span className="font-semibold text-blue-600">{kpi.activationRate}%</span>
            &nbsp;— 전체 {kpi.totalAgents}개 에이전트 중 {kpi.activeAgents}개 실운용
          </p>
          <div className="space-y-3">
            {gateFunnel.map((g) => (
              <div key={g.stage} className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-20 text-center ${GATE_COLOR[g.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                  {GATE_LABEL[g.stage] ?? g.stage}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      g.stage === 'ACTIVE' ? 'bg-green-500' :
                      g.stage === 'GATE3' ? 'bg-purple-400' :
                      g.stage === 'GATE2' ? 'bg-blue-400' :
                      g.stage === 'GATE1' ? 'bg-yellow-400' : 'bg-gray-300'
                    }`}
                    style={{ width: `${(g.count / maxGate) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-800 w-6 text-right">{g.count}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 pt-3 border-t">
            Gate2 통과 시 운용역 리뷰 · Gate3 통과 시 경영진 승인 후 실운용
          </p>
        </div>

        {/* AI 활용 파이프라인 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>AI 활용 파이프라인</SectionTitle>
          <div className="space-y-3">
            {projectFunnel.map((p) => (
              <div key={p.status} className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-16 text-center ${STATUS_COLOR[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      p.status === 'production' ? 'bg-green-500' :
                      p.status === 'pilot' ? 'bg-blue-400' :
                      p.status === 'evaluated' ? 'bg-yellow-400' :
                      p.status === 'submitted' ? 'bg-gray-400' : 'bg-red-300'
                    }`}
                    style={{ width: p.count > 0 ? `${(p.count / kpi.totalProjects) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-800 w-6 text-right">{p.count}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 pt-3 border-t">
            파일럿+운영 = 실제 현업 적용 중인 AI 활용
          </p>
        </div>
      </div>

      {/* 프로젝트별 AI 배치 현황 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <SectionTitle>프로젝트별 AI 에이전트 배치</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b">
                <th className="text-left py-2 font-medium">프로젝트</th>
                <th className="text-center py-2 font-medium w-20">운영</th>
                <th className="text-center py-2 font-medium w-20">Gate3</th>
                <th className="text-center py-2 font-medium w-20">Gate2</th>
                <th className="text-center py-2 font-medium w-20">Gate1</th>
                <th className="text-center py-2 font-medium w-20">합계</th>
              </tr>
            </thead>
            <tbody>
              {axProjects.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3">
                    <span className="font-medium text-gray-900">{p.name}</span>
                  </td>
                  <td className="py-3 text-center">
                    {p.activeAgents > 0 ? (
                      <span className="inline-block w-6 h-6 bg-green-100 text-green-700 text-xs font-bold rounded-full leading-6">
                        {p.activeAgents}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {p.gate3Agents > 0 ? (
                      <span className="text-purple-600 font-medium">{p.gate3Agents}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-3 text-center">
                    {p.gate2Agents > 0 ? (
                      <span className="text-blue-600 font-medium">{p.gate2Agents}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-3 text-center">
                    {p.gate1Agents > 0 ? (
                      <span className="text-yellow-600 font-medium">{p.gate1Agents}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-3 text-center font-semibold text-gray-700">{p.totalAgents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 거버넌스 + AI 역량 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 감사 로그 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>거버넌스 최근 활동</SectionTitle>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-gray-400">최근 감사 활동 없음</p>
          ) : (
            <ul className="space-y-2">
              {auditLogs.map((log) => (
                <li key={log.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {AUDIT_LABEL[log.action] ?? log.action}
                      <span className="ml-2 text-xs text-gray-400">({log.entityType})</span>
                    </p>
                    {log.detail && (
                      <p className="text-xs text-gray-500 truncate">{log.detail}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(log.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 직원 AI 역량 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>임직원 AI 역량 (레벨 분포)</SectionTitle>
          <p className="text-xs text-gray-400 mb-4">총 {totalEmployees}명 기준</p>
          <div className="space-y-2">
            {levelDistribution.filter(l => l.level !== 'L0' || l.count > 0).map((l) => (
              <div key={l.level} className="flex items-center gap-3">
                <span className={`text-xs font-bold w-7 ${
                  l.level === 'L4' ? 'text-purple-600' :
                  l.level === 'L3' ? 'text-orange-600' :
                  l.level === 'L2' ? 'text-green-600' :
                  l.level === 'L1' ? 'text-blue-600' : 'text-gray-400'
                }`}>{l.level}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      l.level === 'L4' ? 'bg-purple-400' :
                      l.level === 'L3' ? 'bg-orange-400' :
                      l.level === 'L2' ? 'bg-green-400' :
                      l.level === 'L1' ? 'bg-blue-400' : 'bg-gray-200'
                    }`}
                    style={{ width: totalEmployees > 0 ? `${(l.count / totalEmployees) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-6 text-right">{l.count}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4 pt-3 border-t">
            L1=AI 리터러시 · L2=AI 활용 · L3=AI 개발 · L4=AI 리더
          </p>
        </div>
      </div>

      {/* 월별 AI 비용 트렌드 */}
      {monthlyCost.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <SectionTitle>월별 AI 비용 추이</SectionTitle>
          <div className="flex items-end gap-2 h-28 mt-2">
            {monthlyCost.map((m, i) => (
              <div key={`${m.month}-${i}`} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500 font-medium">
                  ₩{m.cost >= 1000 ? `${(m.cost / 1000).toFixed(0)}k` : m.cost.toLocaleString()}
                </span>
                <div
                  className="w-full bg-blue-400 rounded-t-sm transition-all"
                  style={{ height: `${Math.max((m.cost / maxCost) * 80, 4)}px` }}
                />
                <span className="text-xs text-gray-400">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 pt-3 border-t">
            누적 총 ₩{kpi.totalCostKrw.toLocaleString()} · {(kpi.totalTokens / 10000).toFixed(0)}만 토큰 소비
          </p>
        </div>
      )}
    </div>
  )
}
