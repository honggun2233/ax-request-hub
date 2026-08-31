import { NextRequest, NextResponse } from 'next/server'

const SEARCH_SERVER = process.env.GOVERNANCE_SEARCH_URL ?? 'http://localhost:8700'

interface SearchRequestBody {
  query: string
  top_k?: number
  is_latest?: boolean
}

export async function POST(req: NextRequest) {
  let body: SearchRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { query, top_k = 5, is_latest = true } = body
  if (!query?.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`${SEARCH_SERVER}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k, is_latest }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err: any) {
    console.error('[governance/search] search_server 연결 실패:', err?.message)
    return NextResponse.json(
      { error: 'search_server unavailable', detail: err?.message },
      { status: 502 }
    )
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`[governance/search] search_server ${res.status}:`, detail)
    return NextResponse.json(
      { error: 'search_server error', status: res.status, detail },
      { status: res.status }
    )
  }

  const data = await res.json()
  return NextResponse.json(data)
}
