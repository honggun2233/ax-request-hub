'use client'
import { useState } from 'react'

const TOOLS = [
  { toolType: 'GPT_CHAT',  toolTier: 'CHAT',       label: 'ChatGPT (Chat)',      desc: '문서 작성, 아이디어 도출, 코드 보조' },
  { toolType: 'GPT_EXCEL', toolTier: 'EXCEL',       label: 'ChatGPT (Excel)',     desc: 'Excel 수식·매크로 자동화, 데이터 분석' },
  { toolType: 'GEMINI',    toolTier: 'ENTERPRISE',  label: 'Gemini Enterprise',   desc: '구글 워크스페이스 통합, 멀티모달 분석' },
]

export function ToolRequestForm({ activeTypes }: { activeTypes: string[] }) {
  const [selected, setSelected] = useState('')
  const [reason, setReason]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]     = useState<{ ok?: boolean; error?: string } | null>(null)

  const available = TOOLS.filter(t => !activeTypes.includes(t.toolType))

  if (available.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)] text-center py-4">
        모든 AI 도구를 이미 사용 중입니다.
      </p>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || reason.length < 20) return
    setSubmitting(true)
    setResult(null)
    const tool = TOOLS.find(t => t.toolType === selected)!
    const res = await fetch('/api/tools/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolType: tool.toolType, toolTier: tool.toolTier, requestReason: reason }),
    })
    const data = await res.json()
    if (res.ok) {
      setResult({ ok: true })
      setTimeout(() => window.location.reload(), 1200)
    } else {
      setResult({ error: data.error ?? '오류가 발생했습니다.' })
      setSubmitting(false)
    }
  }

  if (result?.ok) {
    return (
      <div className="text-center py-6 text-green-600 font-medium text-sm">
        ✓ 신청이 접수됐습니다. AX팀 검토 후 부서장을 통해 배정됩니다.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">신청할 도구 선택</label>
        <div className="grid grid-cols-1 gap-2">
          {available.map(t => (
            <label
              key={t.toolType}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selected === t.toolType
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="toolType"
                value={t.toolType}
                checked={selected === t.toolType}
                onChange={() => setSelected(t.toolType)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">{t.label}</div>
                <div className="text-xs text-[var(--muted)] mt-0.5">{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          신청 사유 <span className="text-[var(--muted)] font-normal">(최소 20자)</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          required
          minLength={20}
          placeholder="업무에서 어떻게 활용할 계획인지 구체적으로 입력하세요."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className={`text-xs mt-1 ${reason.length < 20 ? 'text-[var(--muted)]' : 'text-green-600'}`}>
          {reason.length} / 20자 이상
        </p>
      </div>

      {result?.error && (
        <p className="text-sm text-red-500">{result.error}</p>
      )}

      <button
        type="submit"
        disabled={!selected || reason.length < 20 || submitting}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? '신청 중…' : 'AI 도구 신청'}
      </button>
    </form>
  )
}
