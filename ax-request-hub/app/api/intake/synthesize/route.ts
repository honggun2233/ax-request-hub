import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { gatewayCompleteRouted } from '@/src/lib/ai-gateway/routing'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const email = session.user.email

  // Employee 테이블에서 department, name 조회
  const employee = await prisma.employee.findUnique({
    where: { email },
    select: { name: true, department: true },
  })

  const requesterName = employee?.name ?? (session.user.name ?? '')
  const department = employee?.department ?? ((session.user as any).department ?? '')

  // multipart/form-data 파싱
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'multipart/form-data 파싱 실패' }, { status: 400 })
  }

  const rawText = (formData.get('rawText') as string | null) ?? ''
  const files = formData.getAll('files[]') as File[]

  // 파일 텍스트 추출 (text/*, .md, .txt만 지원)
  const fileTexts: string[] = []
  for (const file of files) {
    if (
      file.type.startsWith('text/') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.txt')
    ) {
      const text = await file.text()
      if (text.trim()) {
        fileTexts.push(`[파일: ${file.name}]\n${text}`)
      }
    }
  }

  const combinedText = [rawText.trim(), ...fileTexts].filter(Boolean).join('\n\n---\n\n')

  if (!combinedText.trim()) {
    return NextResponse.json({ error: '분석할 자료가 없습니다. 파일이나 텍스트를 입력해주세요.' }, { status: 400 })
  }

  const prompt = `다음 자료들에서 AI 에이전트 등록 신청에 필요한 정보를 추출하세요.

[자료]
${combinedText.slice(0, 6000)}

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "title": { "value": "...", "confidence": 85, "source": "어느 자료" },
  "description": { "value": "...", "confidence": 90, "source": "..." },
  "asIs": { "value": "...", "confidence": 75, "source": "..." },
  "expectedBenefit": { "value": "...", "confidence": 80, "source": "..." },
  "agentType": { "value": "SKILL|MCP|WEBAPP|CRAWLING 중 하나 또는 null", "confidence": 70, "source": "..." },
  "scope": { "value": "DEPT|DIVISION|COMPANY 중 하나 또는 null", "confidence": 60, "source": "..." },
  "confidentialityEstimate": { "value": "G1|G2|G3 중 하나", "confidence": 50, "source": "..." },
  "dataNote": { "value": "데이터 설명 또는 null", "confidence": 65, "source": "..." }
}
추출 불가 필드: value=null, confidence=0`

  let fields: Record<string, { value: string | null; confidence: number; source: string }>

  try {
    const response = await gatewayCompleteRouted(
      {
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1200,
        temperature: 0.1,
      },
      {
        taskType: 'SYNTHESIZE',
        taskSummary: 'AI 에이전트 등록 신청 정보 추출 (자유형식 자료 합성)',
      }
    )

    const raw = response.content.trim()
    // JSON 블록 추출 (```json ... ``` 감싸는 경우 대응)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다')
    fields = JSON.parse(jsonMatch[0])
  } catch (e: any) {
    return NextResponse.json({ error: `AI 합성 실패: ${e.message}` }, { status: 500 })
  }

  return NextResponse.json({
    fields: {
      title:                  fields.title                  ?? { value: null, confidence: 0, source: '' },
      description:            fields.description            ?? { value: null, confidence: 0, source: '' },
      asIs:                   fields.asIs                   ?? { value: null, confidence: 0, source: '' },
      expectedBenefit:        fields.expectedBenefit        ?? { value: null, confidence: 0, source: '' },
      agentType:              fields.agentType              ?? { value: null, confidence: 0, source: '' },
      scope:                  fields.scope                  ?? { value: null, confidence: 0, source: '' },
      confidentialityEstimate: fields.confidentialityEstimate ?? { value: 'G2', confidence: 0, source: '' },
      dataNote:               fields.dataNote               ?? { value: null, confidence: 0, source: '' },
    },
    prefilled: {
      department,
      requesterName,
      requesterEmail: email,
    },
    materialCount: fileTexts.length + (rawText.trim() ? 1 : 0),
  })
}
