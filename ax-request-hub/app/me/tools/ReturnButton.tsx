'use client'

export function ReturnButton({ accountId }: { accountId: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/tools/request', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: accountId }),
        })
        window.location.reload()
      }}
      className="text-xs text-red-500 hover:underline"
    >
      반납
    </button>
  )
}
