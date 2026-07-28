import { NextResponse } from 'next/server'
import { db } from '@/src/lib/db'

const SEED_DOCS = [
  {
    docId: 'AX-REG-2026-001',
    fileName: 'AX-REGULATION-2026-001_AI운영규정.md',
    type: '규정', level: 'L1', title: 'AI 운영 규정',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX/PI센터장',
    approvedAt: '2026-01-01', securityLevel: 'G2', status: 'active',
    description: '삼성자산운용 전사 AI 운영의 기본 규정',
  },
  {
    docId: 'AX-REG-2026-002',
    fileName: 'AX-GUIDELINE-2026-001_AI거버넌스기본지침.md',
    type: '규정', level: 'L1', title: 'AI 거버넌스 기본 지침',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX/PI센터장',
    approvedAt: '2026-01-01', securityLevel: 'G2', status: 'active',
    description: 'AI 거버넌스 체계의 기본 원칙과 의사결정 구조',
  },
  {
    docId: 'AX-OPS-2026-001',
    fileName: 'AX-POLICY-2026-001_AI거버넌스지침.md',
    type: '운영방안', level: 'L1', title: 'AI 거버넌스 정책',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-01-01', securityLevel: 'G2', status: 'active',
    description: 'AI 거버넌스 운영을 위한 세부 정책',
  },
  {
    docId: 'AX-MAN-2026-001',
    fileName: 'AX-MANUAL-2026-001_사용가이드라인.md',
    type: '매뉴얼', level: 'L3', title: 'AI 도구 사용 가이드라인',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-01-01', securityLevel: 'G1', status: 'active',
    description: '전 직원 대상 AI 도구 사용 방법 매뉴얼',
  },
  {
    docId: 'AX-GUI-2026-001',
    fileName: 'AX_AI도구계정_관리운영가이드.md',
    type: '지침', level: 'L2', title: 'AI 도구 계정 관리 운영 가이드',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-07-01', securityLevel: 'G2', status: 'active',
    description: 'ChatGPT·Copilot 등 AI 도구 계정 배분 및 관리 기준',
  },
  {
    docId: 'AX-GUI-2026-002',
    fileName: 'AX_AI개발플로우_추가조항.md',
    type: '지침', level: 'L2', title: 'AI 개발 플로우 추가 조항',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-07-01', securityLevel: 'G2', status: 'active',
    description: 'AI 과제 개발 프로세스 보완 조항',
  },
  {
    docId: 'AX-DEV-2026-001',
    fileName: 'AX_개발표준_전사AI과제용.md',
    type: '개발표준', level: 'L3', title: '전사 AI 과제 개발 표준',
    version: 'v1.0', author: 'AX팀 · IT업무개발팀', approvedBy: 'AX팀장',
    approvedAt: '2026-07-01', securityLevel: 'G2', status: 'active',
    description: '전사 AI 과제 개발 시 준수해야 할 기술 표준 및 체크리스트',
  },
  {
    docId: 'AX-TEC-2026-001',
    fileName: 'AX_거버넌스_문서체계.md',
    type: '기술문서', level: 'L4', title: 'AX 거버넌스 문서 체계',
    version: 'v1.0', author: 'AX팀', approvedBy: '',
    approvedAt: null, securityLevel: 'G1', status: 'active',
    description: 'AX Hub 거버넌스 문서 분류 체계 및 관리 원칙',
  },
  {
    docId: 'AX-TEC-2026-002',
    fileName: 'AX_전사AI운영체계_제안_2026-07.md',
    type: '기술문서', level: 'L4', title: '전사 AI 운영체계 제안 (2026-07)',
    version: 'v1.0', author: 'AX팀', approvedBy: '',
    approvedAt: null, securityLevel: 'G2', status: 'draft',
    description: '스킬 관리·문서 관리·계정 배분 등 전사 AI 운영체계 개선 제안',
  },
  {
    docId: 'AX-TEC-2026-003',
    fileName: 'architecture.md',
    type: '기술문서', level: 'L4', title: 'AX Hub 시스템 아키텍처',
    version: 'v1.0', author: 'IT업무개발팀', approvedBy: '',
    approvedAt: null, securityLevel: 'G2', status: 'active',
    description: 'AX Hub Next.js 앱 아키텍처 및 모듈 구조 설명',
  },
  {
    docId: 'AX-TEC-2026-004',
    fileName: 'registry-lifecycle-design.md',
    type: '기술문서', level: 'L4', title: 'ETF 에이전트 레지스트리 라이프사이클 설계',
    version: 'v1.0', author: 'IT업무개발팀', approvedBy: '',
    approvedAt: null, securityLevel: 'G2', status: 'active',
    description: 'ETF 앙상블 에이전트 Gate 라이프사이클(GATE1~3) 설계 문서',
  },
]

export async function POST(req: Request) {
  // Admin-only: seed 엔드포인트는 인증 없이 호출 가능한 보안 결함 수정 (P2-3)
  const { getServerSession } = await import('next-auth')
  const { authOptions } = await import('@/lib/auth')
  const session = await getServerSession(authOptions)
  if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: '권한 없음 — AX팀만 실행 가능' }, { status: 403 })
  }

  try {
    const results = []
    for (const d of SEED_DOCS) {
      const doc = await db.governanceDoc.upsert({
        where: { docId: d.docId },
        create: {
          ...d,
          approvedAt: d.approvedAt ? new Date(d.approvedAt) : null,
          relatedDocs: '[]',
        },
        update: {
          title: d.title, type: d.type, level: d.level,
          version: d.version, author: d.author, approvedBy: d.approvedBy,
          securityLevel: d.securityLevel, status: d.status, description: d.description,
          approvedAt: d.approvedAt ? new Date(d.approvedAt) : null,
        },
      })
      results.push(doc.docId)
    }
    return NextResponse.json({ seeded: results.length, docs: results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
