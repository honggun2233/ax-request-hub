import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/authz'
import { gatewayComplete } from '@/src/lib/ai-gateway/gateway'

// AX_INTAKE_V1 Tier0 파서
// 표준 포맷이 감지되면 LLM 호출 없이 룰 기반으로 파싱 (aiConfidence=100)
// 감지 실패 시 422 반환 (Tier1 LLM 파싱은 추후 구현)

const FIELD_MAP: Record<string, string> = {
  '프로젝트명':    'title',
  '부서':          'department',
  '목적(왜 지금)': 'description',
  '목적':          'description',
  'as-is':         'asIs',
  'AS-IS':         'asIs',
  '기대효과':      'expectedBenefit',
  '필요 데이터':   '_dataNote',
  '에이전트 유형': 'agentType',
  '공개범위':      'scope',
  '기밀등급 추정': 'confidentialityLevel',
  '챔피언':        'championName',
  '비즈니스 스폰서': 'championName',
}

const VALID_AGENT_TYPES = ['SKILL', 'MCP', 'WEBAPP', 'CRAWLING']
const VALID_SCOPES      = ['DEPT', 'DIVISION', 'COMPANY']
const VALID_CONF        = ['G1', 'G2', 'G3']

function parseStandardFormat(raw: string): Record<string, string> | null {
  if (!raw.includes('## AX_INTAKE_V1')) return null

  const result: Record<string, string> = {}
  const lines = raw.split('\n')

  for (const line of lines) {
    const match = line.match(/^-\s+([^:]+):\s*(.*)$/)
    if (!match) continue
    const key   = match[1].trim()
    const value = match[2].trim().replace(/\(.*?\)/g, '').trim() // 괄호 힌트 제거
    const mapped = FIELD_MAP[key] ?? FIELD_MAP[key.toLowerCase()]
    if (mapped && value) result[mapped] = value
  }

  // 필수 필드 체크
  const required = ['title', 'department', 'description', 'asIs', 'expectedBenefit']
  for (const f of required) {
    if (!result[f]) return null
  }

  // agentType 정규화
  if (result.agentType) {
    const upper = result.agentType.toUpperCase()
    result.agentType = VALID_AGENT_TYPES.find(v => upper.includes(v)) ?? ''
  }

  // scope 정규화
  if (result.scope) {
    const upper = result.scope.toUpperCase()
    result.scope = VALID_SCOPES.find(v => upper.includes(v)) ?? ''
  }

  // confidentialityLevel 정규화
  if (result.confidentialityLevel) {
    const m = result.confidentialityLevel.match(/G[123]/)
    result.confidentialityLevel = m ? m[0] : 'G2'
  } else {
    result.confidentialityLevel = 'G2'
  }

  return result
}

export async function POST(req: NextRequest) {
  const auth = await requireRole()
  if ('error' in auth) return auth.error

  try {
    let rawText = ''
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
      // 텍스트 파일만 직접 처리 (PDF/DOCX는 추후 구현)
      if (file.type.includes('text') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        rawText = await file.text()
      } else {
        return NextResponse.json(
          { error: 'PDF/DOCX 파싱은 아직 지원되지 않습니다. 텍스트(.md, .txt) 파일을 사용하거나 표준 프롬프트 채널을 이용하세요.' },
          { status: 422 }
        )
      }
    } else {
      const body = await req.json()
      rawText = body.rawText ?? ''
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: '내용이 없습니다' }, { status: 400 })
    }

    // Tier0: 표준 포맷 감지 및 파싱
    let parsed = parseStandardFormat(rawText)
    let tier = 0
    let aiConfidence = 100

    // Tier1: 자유형식 텍스트 → Claude로 필드 추출
    if (!parsed) {
      const extractPrompt = `다음 텍스트에서 AI 에이전트 등록 신청 정보를 추출하세요.

텍스트:
${rawText.slice(0, 3000)}

아래 JSON 형식으로만 응답하세요 (없는 필드는 null):
{
  "title": "프로젝트명",
  "department": "부서명",
  "description": "목적·배경",
  "asIs": "현재 상태(As-Is)",
  "expectedBenefit": "기대효과",
  "_dataNote": "필요 데이터 (없으면 null)",
  "agentType": "SKILL|MCP|WEBAPP|CRAWLING 중 하나 (판단 불가 시 null)",
  "scope": "DEPT|DIVISION|COMPANY 중 하나 (판단 불가 시 null)",
  "confidentialityLevel": "G1|G2|G3 중 하나 (기본 G2)"
}`
      try {
        const res = await gatewayComplete({
          messages: [{ role: 'user', content: extractPrompt }],
          maxTokens: 600,
          temperature: 0.1,
        })
        const extracted = JSON.parse(res.content.trim())
        const required = ['title', 'department', 'description', 'asIs', 'expectedBenefit']
        const filled = required.filter(f => extracted[f]?.trim?.())
        aiConfidence = Math.round((filled.length / required.length) * 80) // Tier1 최대 80
        if (filled.length < 3) {
          return NextResponse.json(
            { error: 'AI가 텍스트에서 필수 정보를 충분히 추출하지 못했습니다. 표준 프롬프트를 사용하거나 직접 입력해 주세요.' },
            { status: 422 }
          )
        }
        // agentType/scope 정규화
        if (extracted.agentType) {
          const u = extracted.agentType.toUpperCase()
          extracted.agentType = VALID_AGENT_TYPES.find(v => u.includes(v)) ?? null
        }
        if (extracted.scope) {
          const u = extracted.scope.toUpperCase()
          extracted.scope = VALID_SCOPES.find(v => u.includes(v)) ?? null
        }
        if (!extracted.confidentialityLevel || !VALID_CONF.includes(extracted.confidentialityLevel)) {
          extracted.confidentialityLevel = 'G2'
        }
        parsed = extracted
        tier = 1
        // GatewayCallLog 기록 (B트랙 — AX Hub 자체 AI 호출)
        await prisma.gatewayCallLog.create({
          data: {
            providerKey: res.provider,
            taskType: 'TIER1_PARSE',
            inputTokens: res.inputTokens,
            outputTokens: res.outputTokens,
            totalTokens: res.totalTokens,
            costKrw: Math.round(res.inputTokens / 1000 * 12 + res.outputTokens / 1000 * 36),
          },
        }).catch(() => {})
      } catch (e: any) {
        return NextResponse.json(
          { error: `Tier1 파싱 실패: ${e.message}. 표준 프롬프트를 사용하거나 직접 입력해 주세요.` },
          { status: 422 }
        )
      }
    }

    if (!parsed) {
      return NextResponse.json(
        { error: '## AX_INTAKE_V1 형식이 아닙니다. 표준 프롬프트로 생성한 전체 답변을 붙여넣거나 직접 입력 방식을 이용하세요.' },
        { status: 422 }
      )
    }

    // 사원 조회
    const requester = await prisma.employee.findUnique({
      where: { email: auth.user.email! },
      select: { id: true },
    })

    // 프로젝트 생성
    const project = await prisma.project.create({
      data: {
        title:               parsed.title,
        department:          parsed.department,
        requesterEmail:      auth.user.email!,
        requesterName:       auth.user.name ?? '',
        description:         parsed.description,
        asIs:                parsed.asIs,
        expectedBenefit:     parsed.expectedBenefit,
        confidentialityLevel: parsed.confidentialityLevel,
        agentType:           parsed.agentType || null,
        scope:               parsed.scope || null,
        intakeMethod:        contentType.includes('multipart/form-data') ? 'FILE' : 'STANDARD_FORMAT',
        aiConfidence:        aiConfidence,
        noDataRequired:      !parsed._dataNote || parsed._dataNote === '없음' || parsed._dataNote === '불필요',
        championName:        parsed.championName || null,
        source:              'standard_format',
      },
    })

    // 데이터 요건이 언급됐으면 DRAFT DataRequest 생성
    if (parsed._dataNote && parsed._dataNote !== '없음' && parsed._dataNote !== '불필요' && requester) {
      await prisma.dataRequest.create({
        data: {
          projectId:     project.id,
          requesterId:   requester.id,
          type:          'ACCESS',
          classification: project.confidentialityLevel,
          purpose:       project.description,
          periodMonths:  12,
          includesPII:   false,
          isAnonymized:  false,
          forProduction: false,
          status:        'DRAFT',
          requestedSpec: parsed._dataNote,
        },
      })
    }

    return NextResponse.json({ ...project, _tier: tier, _aiConfidence: aiConfidence }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Internal Server Error' }, { status: 500 })
  }
}
