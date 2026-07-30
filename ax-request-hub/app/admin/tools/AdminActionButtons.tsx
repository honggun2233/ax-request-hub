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
