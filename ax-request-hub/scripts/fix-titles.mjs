import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TITLES = [
  { docId: 'AX-COM-2026-001', title: '[규정]_AI 운영위원회 및 실무협의체 운영 규정' },
  { docId: 'AX-DEV-2026-001', title: '[개발표준]_AX팀 AI 개발·배포 플로우 추가 조항' },
  { docId: 'AX-DEV-2026-002', title: '[개발표준]_AI 과제 개발 표준' },
  { docId: 'AX-MAN-2026-001', title: '[매뉴얼]_AX Request Hub 사용 가이드라인' },
  { docId: 'AX-OPS-2026-001', title: '[가이드라인]_AI 에이전트 등록·통제 지침' },
  { docId: 'AX-OPS-2026-002', title: '[가이드라인]_전사 AI 도구 계정 관리 운영 가이드' },
  { docId: 'AX-OPS-2026-003', title: '[가이드라인]_생성형 AI 모델 배분 기준 지침' },
  { docId: 'AX-POL-2026-001', title: '[지침]_AI 운영 지침' },
  { docId: 'AX-REG-2026-001', title: '[규정]_AI 운영 규정' },
  { docId: 'AX-STD-2026-001', title: '[운영방안]_AI 운영기준' },
  { docId: 'AX-STD-2026-002', title: '[운영방안]_AX AI 리터러시 레벨 운영 기준' },
  { docId: 'AX-STD-2026-003', title: '[운영방안]_AX 스킬 라이브러리 운영 기준' },
  { docId: 'AX-STD-2026-004', title: '[운영방안]_AX 토큰 정책 운영 기준' },
]

for (const { docId, title } of TITLES) {
  await prisma.governanceDoc.update({ where: { docId }, data: { title } })
  console.log(`OK: ${docId} → ${title}`)
}

const all = await prisma.governanceDoc.findMany({ select: { docId: true, title: true }, orderBy: { docId: 'asc' } })
console.log('\n--- 검증 ---')
for (const r of all) console.log(r.docId, '|', r.title)

await prisma.$disconnect()
