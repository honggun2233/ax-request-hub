'use client'
import { useState } from 'react'

export function EvaluateButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleEvaluate() {
    setLoading(true); setMsg(null)
    try {
      const res = await fetch(`/api/evaluate/${projectId}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error ?? '오류 발생'); setLoading(false); return }
      window.location.reload()
    } catch {
      setMsg('네트워크 오류'); setLoading(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleEvaluate}
        disabled={loading}
        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors w-full
          ${loading
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
      >
        {loading ? '채점 중…' : 'Gate3 채점 시작'}
      </button>
      {msg && <p className="mt-1 text-[10px] text-red-500">{msg}</p>}
    </div>
  )
}
