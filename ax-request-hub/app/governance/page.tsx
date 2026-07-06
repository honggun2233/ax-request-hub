'use client'

import Link from 'next/link'

const AUDIT_LOG = [
  { id: 'a1', projectTitle: 'STT 회의록 자동 변환', department: 'IT팀', decision: 'auto_approved', totalScore: 88, modelVersion: 'claude-sonnet-4-6', evaluatedAt: '2026-05-20 14:23', escalatedTo: null, overrideReason: null },
  { id: 'a2', projectTitle: '고객 문의 자동 분류', department: '고객지원팀', decision: 'auto_approved', totalScore: 91, modelVersion: 'claude-sonnet-4-6', evaluatedAt: '2026-06-01 09:45', escalatedTo: null, overrideReason: null },
  { id: 'a3', projectTitle: '펀드 공시 문서 자동화', department: '준법감시팀', decision: 'auto_approved', totalScore: 79, modelVersion: 'claude-sonnet-4-6', evaluatedAt: '2026-06-10 11:12', escalatedTo: null, overrideReason: null },
  { id: 'a4', projectTitle: '계약서 검토 자동화', department: '법무팀', decision: 'auto_approved', totalScore: 82, modelVersion: 'claude-sonnet-4-6', evaluatedAt: '2026-06-15 16:05', escalatedTo: null, overrideReason: null },
  { id: 'a5', projectTitle: '신규 직원 온보딩 챗봇', department: 'HR팀', decision: 'auto_approved', totalScore: 71, modelVersion: 'claude-sonnet-4-6', evaluatedAt: '2026-06-22 10:30', escalatedTo: null, overrideReason: null },
  { id: 'a6', projectTitle: 'ESG 리포트 데이터 수집', department: '리서치팀', decision: 'escalated', totalScore: 65, modelVersion: 'claude-sonnet-4-6', evaluatedAt: '2026-06-30 14:55', escalatedTo: '홍인표 (AX팀장)', overrideReason: null },
  { id: 'a7', projectTitle: '투자설명서 초안 작성', department: '운용팀', decision: 'escalated', totalScore: 58, modelVersion: 'claude-sonnet-4-6', evaluatedAt: '2026-06-28 09:20', escalatedTo: '홍인표 (AX팀장)', overrideReason: 'G3 기밀등급 + 점수 미달 — 컴플라이언스 검토 필요' },
  { id: 'a8', projectTitle: '월간 보고서 자동 생성', department: '기획팀', decision: 'auto_approved', totalScore: 74, modelVersion: 'claude-sonnet-4-6', evaluatedAt: '2026-06-20 13:40', escalatedTo: null, overrideReason: null },
]

// 최신순 정렬
const SORTED_LOG = [...AUDIT_LOG].sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt))

export default function GovernancePage() {
  const total = AUDIT_LOG.length
  const autoApproved = AUDIT_LOG.filter(l => l.decision === 'auto_approved').length
  const escalated = AUDIT_LOG.filter(l => l.decision === 'escalated').length
  const autoRate = Math.round((autoApproved / total) * 100)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 mb-1 inline-block">← 홈으로</Link>
            <h1 className="text-2xl font-bold text-gray-900">거버넌스 감사 로그</h1>
            <p className="text-sm text-gray-500 mt-1">AI 평가·승인 이력 전체 기록</p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            대시보드 →
          </Link>
        </div>

        {/* Summary Bar */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-8 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">{total}건</span>
              <span className="text-sm text-gray-500">총 평가</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-green-600">{autoApproved}건</span>
              <span className="text-sm text-gray-500">자동승인 ({autoRate}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-yellow-600">{escalated}건</span>
              <span className="text-sm text-gray-500">에스컬레이션 ({100 - autoRate}%)</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                claude-sonnet-4-6
              </span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-3 mb-8">
          {SORTED_LOG.map((log) => {
            const isEscalated = log.decision === 'escalated'
            const isHighlight = isEscalated
            return (
              <div
                key={log.id}
                className={`bg-white rounded-xl p-5 shadow-sm border transition-colors ${
                  isHighlight ? 'border-yellow-200 bg-yellow-50' : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">{isEscalated ? '🟡' : '🟢'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{log.projectTitle}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isEscalated
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {isEscalated ? '에스컬레이션' : '자동승인'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{log.department}</p>
                      {log.escalatedTo && (
                        <p className="text-xs text-yellow-700 mt-1">
                          담당자: {log.escalatedTo}
                        </p>
                      )}
                      {log.overrideReason && (
                        <p className="text-xs text-yellow-800 mt-1 bg-yellow-100 px-2 py-1 rounded">
                          사유: {log.overrideReason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${log.totalScore >= 70 ? 'text-green-600' : 'text-orange-500'}`}>
                      {log.totalScore}점
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{log.evaluatedAt}</p>
                    <p className="text-xs font-mono text-gray-300 mt-0.5">{log.modelVersion}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Policy Box */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">📋 현재 자동승인 정책</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 총점 <strong>70점 이상</strong> + 기밀등급 <strong>G1 또는 G2</strong> → 자동승인</li>
            <li>• G3 등급 또는 70점 미만 → 담당자 에스컬레이션</li>
          </ul>
          <p className="text-xs text-blue-400 mt-3">정책 버전: v1.0 · 2026-06-01 적용</p>
        </div>
      </div>
    </div>
  )
}
