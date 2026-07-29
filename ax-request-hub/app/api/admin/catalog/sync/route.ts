// POST /api/admin/catalog/sync
// AX_TEAM 또는 DATA_PLATFORM 역할 필요
import { requireRole } from '@/lib/authz'
import { syncSnowflakeCatalog } from '@/lib/snowflake'

export async function POST(_request: Request) {
  const { error } = await requireRole('AX_TEAM', 'DATA_PLATFORM')
  if (error) return error
  const result = await syncSnowflakeCatalog()
  return Response.json({ ok: true, ...result })
}
