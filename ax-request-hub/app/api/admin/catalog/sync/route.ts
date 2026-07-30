// POST /api/admin/catalog/sync
// Snowflake 연동은 PoC 단계 — 환경 구축 후 활성화 예정
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Snowflake 연동이 아직 구성되지 않았습니다. SNOWFLAKE_* 환경변수 및 패키지 설치 후 활성화하세요.' },
    { status: 501 },
  )
}
