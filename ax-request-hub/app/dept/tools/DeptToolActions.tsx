'use client'

export function AdminActionButtons({ accId }: { accId: string }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={async () => {
          await fetch(`/api/admin/tools/${accId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'APPROVED' }),
          })
          window.location.reload()
        }}
        className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
      >
        SDS 요청완료 → 승인
      </button>
      <button
        onClick={async () => {
          await fetch(`/api/admin/tools/${accId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'RETURNED' }),
          })
          window.location.reload()
        }}
        className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300"
      >
        반려
      </button>
    </div>
  )
}

const TOOL_LABEL: Record<string, string> = {
  GPT_CHAT: 'ChatGPT (Chat)',
  GPT_EXCEL: 'ChatGPT (Excel)',
  GEMINI: 'Gemini Enterprise',
}

export function RevokeButton({ accountId, name }: { accountId: string; name: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm(`${name} 계정을 회수하시겠습니까?`)) return
        await fetch('/api/dept/tools/revoke', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId }),
        })
        window.location.reload()
      }}
      className="text-xs text-red-500 hover:underline"
    >
      회수
    </button>
  )
}

export function DeptAssignForm({
  quotas,
}: {
  quotas: { id: string; toolType: string; department: string; remaining: number }[]
}) {
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const res = await fetch('/api/dept/tools/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeEmail: fd.get('employeeEmail'),
            quotaId: fd.get('quotaId'),
            requestReason: fd.get('requestReason'),
          }),
        })
        if (res.ok) {
          alert('배정 신청이 완료됐습니다. AX팀이 SDS를 통해 계정을 발급합니다.')
          window.location.reload()
        } else {
          const data = await res.json()
          alert(data.error ?? '오류가 발생했습니다.')
        }
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">팀원 이메일</label>
        <input
          name="employeeEmail"
          type="email"
          required
          placeholder="hong@samsung.com"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">도구 · 부서 선택</label>
        <select
          name="quotaId"
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">선택하세요</option>
          {quotas.map((q) => (
            <option key={q.id} value={q.id} disabled={q.remaining <= 0}>
              {q.department} — {TOOL_LABEL[q.toolType] ?? q.toolType} (잔여 {q.remaining}석)
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">배정 사유 (20자 이상)</label>
        <textarea
          name="requestReason"
          required
          minLength={20}
          rows={3}
          placeholder="업무 활용 계획을 구체적으로 입력하세요"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
      <button
        type="submit"
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition"
      >
        배정 신청
      </button>
    </form>
  )
}
