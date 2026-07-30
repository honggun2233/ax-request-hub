'use client'

export function ApproveButtons({ projectId }: { projectId: string }) {
  async function handleAction(action: 'approve' | 'reject') {
    await fetch(`/api/approve/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    window.location.reload()
  }

  return (
    <div className="mt-2 flex gap-1.5">
      <button
        onClick={() => handleAction('approve')}
        className="text-xs px-2.5 py-1 rounded-lg font-medium bg-green-100 text-green-700 hover:bg-green-200"
      >
        승인
      </button>
      <button
        onClick={() => handleAction('reject')}
        className="text-xs px-2.5 py-1 rounded-lg font-medium bg-red-100 text-red-600 hover:bg-red-200"
      >
        반려
      </button>
    </div>
  )
}
