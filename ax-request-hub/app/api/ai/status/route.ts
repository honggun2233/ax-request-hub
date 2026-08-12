import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { getProviderStatus } from '@/src/lib/ai-gateway/registry'

export async function GET() {
  const auth = await requireRole('AX_TEAM')
  if ('error' in auth) return auth.error

  const status = getProviderStatus()
  return NextResponse.json({
    providers: Object.entries(status).map(([key, configured]) => ({
      key,
      configured,
      envVar: {
        anthropic: 'ANTHROPIC_API_KEY',
        openai: 'OPENAI_API_KEY or AZURE_OPENAI_KEY + AZURE_OPENAI_ENDPOINT',
        gemini: 'GEMINI_API_KEY',
      }[key],
    })),
  })
}
