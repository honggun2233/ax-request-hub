import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// docId 체계: AI-{TYPE}-{YYYY}-{NNN}
//   REG=규정 | GUI=지침 | STD=운영기준 | OPS=가이드 | DEV=개발표준 | MAN=매뉴얼 | TEC=기술문서

// 구버전 docId → deprecated 처리 대상 (relatedDocs 참조 보존을 위해 status만 변경)
const DEPRECATED_IDS = ['AX-REG-2026-001', 'AX-REG-2026-002', 'AX-OPS-2026-001',
  'AX-GUI-2026-001', 'AX-GUI-2026-002', 'AX-MAN-2026-001', 'AX-DEV-2026-001']

const SEED_DOCS = [
  // ── L1 규정 ──────────────────────────────────────────────────────────
  {
    docId: 'AI-REG-2026-001',
    fileName: '[규정]_AI운영규정_ai-reg-2026-001.md',
    type: '규정', level: 'L1', title: 'AI 운영 규정',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX/PI센터장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: '삼성자산운용 전사 AI 운영의 기본 규정 (2026-09-01 신규 제정)',
    relatedDocs: ['AI-REG-2026-002', 'AI-REG-2026-003', 'AI-GUI-2026-001'],
  },
  {
    docId: 'AI-REG-2026-002',
    fileName: '[규정]_AI위원회규정_ai-reg-2026-002.md',
    type: '규정', level: 'L1', title: 'AI 위원회 규정',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX/PI센터장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: 'AI 위원회 구성·운영·의결 절차 규정 (2026-09-01 신규 제정)',
    relatedDocs: ['AI-REG-2026-001', 'AI-REG-2026-003'],
  },
  {
    docId: 'AI-REG-2026-003',
    fileName: '[규정]_AI위험관리규정_ai-reg-2026-003.md',
    type: '규정', level: 'L1', title: 'AI 위험관리 규정',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX/PI센터장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: 'AI 위험 유형(R-01~R-11)·고영향 AI·FRIA 법적 근거 규정 (2026-09-01 신규 제정)',
    relatedDocs: ['AI-REG-2026-001', 'AI-GUI-2026-002'],
  },
  // ── L2 지침 ──────────────────────────────────────────────────────────
  {
    docId: 'AI-GUI-2026-001',
    fileName: '[지침]_AI운영지침_ai-gui-2026-001.md',
    type: '지침', level: 'L2', title: 'AI 운영 지침',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: '과제 신청·승인·Gate·에이전트 등록(제16조) 세부 절차 (2026-09-01 신규 제정)',
    relatedDocs: ['AI-REG-2026-001', 'AI-GUI-2026-002', 'AI-STD-2026-001'],
  },
  {
    docId: 'AI-GUI-2026-002',
    fileName: '[지침]_AI위험관리지침_ai-gui-2026-002.md',
    type: '지침', level: 'L2', title: 'AI 위험관리 지침',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: '위험 매트릭스·FRIA·투명성 표시 이행 기준(제12조) 세부 절차 (2026-09-01 신규 제정)',
    relatedDocs: ['AI-REG-2026-003', 'AI-GUI-2026-001'],
  },
  // ── L3 운영기준·가이드·매뉴얼 ────────────────────────────────────────
  {
    docId: 'AI-STD-2026-001',
    fileName: '[가이드라인]_AI운영기준_ax-std-2026-001.md',
    type: '운영기준', level: 'L3', title: 'AI 운영기준 (별표)',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: '승인 점수·기밀등급·Gate 기준 수치 SSOT (AI-GUI-001 별표)',
    relatedDocs: ['AI-GUI-2026-001'],
  },
  {
    docId: 'AI-STD-2026-002',
    fileName: '[가이드라인]_AI리터러시레벨운영기준_ax-std-2026-002.md',
    type: '운영기준', level: 'L3', title: 'AI 리터러시 레벨 운영기준',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: 'L0~L4 리터러시 레벨 정의·취득 기준·도구 배분 연동',
    relatedDocs: ['AI-GUI-2026-001'],
  },
  {
    docId: 'AI-STD-2026-003',
    fileName: '[가이드라인]_AX스킬라이브러리운영기준_ax-std-2026-003.md',
    type: '운영기준', level: 'L3', title: 'AX 스킬 라이브러리 운영기준',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: '스킬 6단계 표준(탐색→배포) 및 카탈로그 관리 기준',
    relatedDocs: ['AI-GUI-2026-001'],
  },
  {
    docId: 'AI-STD-2026-004',
    fileName: '[가이드라인]_AX토큰정책운영기준_ax-std-2026-004.md',
    type: '운영기준', level: 'L3', title: 'AX 토큰 정책 운영기준',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: '월별 토큰 한도·경고 임계치·초과 정책',
    relatedDocs: ['AI-GUI-2026-001'],
  },
  {
    docId: 'AI-OPS-2026-001',
    fileName: '[가이드라인]_AI에이전트등록운영가이드_ax-ops-2026-001.md',
    type: '가이드', level: 'L3', title: 'AI 에이전트 등록 운영가이드',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: '유형 3·4 에이전트 등록 신청·검토·Agent ID 부여 절차',
    relatedDocs: ['AI-GUI-2026-001', 'AI-REG-2026-003'],
  },
  {
    docId: 'AI-OPS-2026-002',
    fileName: '[가이드라인]_AI도구계정관리운영가이드_ax-ops-2026-002.md',
    type: '가이드', level: 'L3', title: 'AI 도구 계정관리 운영가이드',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: 'ChatGPT·Copilot·Claude 등 AI 도구 계정 배분·회수·관리 기준',
    relatedDocs: ['AI-GUI-2026-001'],
  },
  {
    docId: 'AI-OPS-2026-003',
    fileName: '[가이드라인]_생성형AI모델배분운영가이드_ax-ops-2026-003.md',
    type: '가이드', level: 'L3', title: '생성형 AI 모델 배분 운영가이드',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: '업무 유형별 모델 배분 기준 및 순량제·정액제 운영 원칙',
    relatedDocs: ['AI-GUI-2026-001', 'AI-STD-2026-004'],
  },
  {
    docId: 'AI-DEV-2026-001',
    fileName: '[가이드라인]_AI개발플로우추가조항_ax-dev-2026-001.md',
    type: '개발표준', level: 'L3', title: 'AI 개발플로우 추가 조항',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: 'AI 과제 개발 프로세스 보완 조항 (Gate 2 기술표준 자가점검 포함)',
    relatedDocs: ['AI-GUI-2026-001', 'AI-DEV-2026-002'],
  },
  {
    docId: 'AI-DEV-2026-002',
    fileName: '[가이드라인]_전사AI과제개발표준_ax-dev-2026-002.md',
    type: '개발표준', level: 'L3', title: '전사 AI 과제 개발 표준',
    version: 'v1.0', author: 'AX팀 · IT업무개발팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'RESTRICTED', status: 'active',
    description: '전사 AI 과제 개발 시 준수해야 할 기술 표준 및 체크리스트',
    relatedDocs: ['AI-DEV-2026-001'],
  },
  {
    docId: 'AI-MAN-2026-001',
    fileName: '[매뉴얼]_AX허브사용안내_ax-man-2026-001.md',
    type: '매뉴얼', level: 'L3', title: 'AX Hub 사용 안내 매뉴얼',
    version: 'v1.0', author: 'AX팀', approvedBy: 'AX팀장',
    approvedAt: '2026-09-01', securityLevel: 'PUBLIC', status: 'active',
    description: '전 직원 대상 AX Request Hub 사용 방법 안내',
    relatedDocs: ['AI-GUI-2026-001'],
  },
  // ── L4 기술문서 (내부용) ────────────────────────────────────────────
  {
    docId: 'AX-TEC-2026-001',
    fileName: 'AX_거버넌스_문서체계.md',
    type: '기술문서', level: 'L4', title: 'AX 거버넌스 문서 체계',
    version: 'v1.0', author: 'AX팀', approvedBy: '',
    approvedAt: null, securityLevel: 'PUBLIC', status: 'active',
    description: 'AX Hub 거버넌스 문서 분류 체계 및 관리 원칙',
    relatedDocs: [],
  },
  {
    docId: 'AX-TEC-2026-003',
    fileName: 'architecture.md',
    type: '기술문서', level: 'L4', title: 'AX Hub 시스템 아키텍처',
    version: 'v1.0', author: 'IT업무개발팀', approvedBy: '',
    approvedAt: null, securityLevel: 'RESTRICTED', status: 'active',
    description: 'AX Hub Next.js 앱 아키텍처 및 모듈 구조 설명',
    relatedDocs: [],
  },
  {
    docId: 'AX-TEC-2026-004',
    fileName: 'registry-lifecycle-design.md',
    type: '기술문서', level: 'L4', title: 'ETF 에이전트 레지스트리 라이프사이클 설계',
    version: 'v1.0', author: 'IT업무개발팀', approvedBy: '',
    approvedAt: null, securityLevel: 'RESTRICTED', status: 'active',
    description: 'ETF 앙상블 에이전트 Gate 라이프사이클(GATE1~3) 설계 문서',
    relatedDocs: [],
  },
]

export async function POST(req: Request) {
  // DEV 환경에서만 인증 우회 허용 (seed는 일회성 운영 작업)
  if (process.env.NODE_ENV !== 'development') {
    const { getServerSession } = await import('next-auth')
    const { authOptions } = await import('@/lib/auth')
    const session = await getServerSession(authOptions)
    if (!session || !['AX_TEAM', 'C_LEVEL'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: '권한 없음 — AX팀만 실행 가능' }, { status: 403 })
    }
  }

  try {
    // 1. 구버전 docId deprecated 처리 (relatedDocs 참조 보존, 레코드 삭제 없음)
    for (const oldId of DEPRECATED_IDS) {
      await prisma.governanceDoc.updateMany({
        where: { docId: oldId, status: { not: 'deprecated' } },
        data: { status: 'deprecated' },
      })
    }

    // 2. 신규 문서 upsert
    const results = []
    for (const d of SEED_DOCS) {
      const doc = await prisma.governanceDoc.upsert({
        where: { docId: d.docId },
        create: {
          docId: d.docId, fileName: d.fileName, type: d.type, level: d.level,
          title: d.title, version: d.version, author: d.author, approvedBy: d.approvedBy,
          securityLevel: d.securityLevel, status: d.status, description: d.description,
          relatedDocs: JSON.stringify(d.relatedDocs ?? []),
          approvedAt: d.approvedAt ? new Date(d.approvedAt) : null,
        },
        update: {
          fileName: d.fileName, type: d.type, level: d.level,
          title: d.title, version: d.version, author: d.author, approvedBy: d.approvedBy,
          securityLevel: d.securityLevel, status: d.status, description: d.description,
          relatedDocs: JSON.stringify(d.relatedDocs ?? []),
          approvedAt: d.approvedAt ? new Date(d.approvedAt) : null,
        },
      })
      results.push(doc.docId)
    }
    return NextResponse.json({ seeded: results.length, deprecated: DEPRECATED_IDS.length, docs: results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
