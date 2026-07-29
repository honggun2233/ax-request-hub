// POST /api/admin/catalog/sync
// AX_TEAM 또는 DATA_PLATFORM 역할 필요
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { syncSnowflakeCatalog } from '@/lib/snowflake'

const REQUIRED_ENV_VARS = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD'] as const

export async function POST(_request: Request) {
  const { error } = await requireRole('AX_TEAM', 'DATA_PLATFORM')
  if (error) return error

  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Snowflake 환경변수 미설정: ${missing.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const { upserted } = await syncSnowflakeCatalog()
    const syncedAt = new Date().toISOString()
    return NextResponse.json({ upserted, syncedAt })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Snowflake 동기화 실패'
    console.error('[catalog/sync POST]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
