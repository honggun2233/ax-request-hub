import { PrismaClient } from '@prisma/client'
import { rename, mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = path.join(__dirname, '..', 'docs')
const GOV_DIR = path.join(DOCS_DIR, 'governance')

const prisma = new PrismaClient()

// 새 폴더 4개 생성
const NEW_DIRS = ['l1-규정', 'l2-지침', 'l3-가이드라인', 'l3-매뉴얼']
for (const d of NEW_DIRS) {
  await mkdir(path.join(GOV_DIR, d), { recursive: true })
  console.log(`DIR  governance/${d}/`)
}

// [docId, 구 fileName, 새 fileName, 새 type, 새 title]
const CHANGES = [
  // L1 규정 — 파일명 변경 없음, 폴더만 이동
  ['AX-REG-2026-001',
    'governance/full/[규정]_AI운영규정_ax-reg-2026-001.md',
    'governance/l1-규정/[규정]_AI운영규정_ax-reg-2026-001.md',
    '규정', '[규정]_AI 운영 규정'],
  ['AX-COM-2026-001',
    'governance/full/[규정]_AI운영위원회규정_ax-com-2026-001.md',
    'governance/l1-규정/[규정]_AI운영위원회규정_ax-com-2026-001.md',
    '규정', '[규정]_AI 운영위원회 및 실무협의체 운영 규정'],

  // L2 지침
  ['AX-POL-2026-001',
    'governance/full/[지침]_AI운영지침_ax-pol-2026-001.md',
    'governance/l2-지침/[지침]_AI운영지침_ax-pol-2026-001.md',
    '지침', '[지침]_AI 운영 지침'],

  // 운영방안 → 가이드라인으로 타입 변경, l2-지침 → l3-가이드라인으로 이동
  ['AX-STD-2026-001',
    'governance/full/[운영방안]_AI운영기준_ax-std-2026-001.md',
    'governance/l3-가이드라인/[가이드라인]_AI운영기준_ax-std-2026-001.md',
    '가이드라인', '[가이드라인]_AI 운영기준'],
  ['AX-STD-2026-002',
    'governance/operations/[운영방안]_AI리터러시레벨운영기준_ax-std-2026-002.md',
    'governance/l3-가이드라인/[가이드라인]_AI리터러시레벨운영기준_ax-std-2026-002.md',
    '가이드라인', '[가이드라인]_AX AI 리터러시 레벨 운영기준'],
  ['AX-STD-2026-003',
    'governance/operations/[운영방안]_AX스킬라이브러리운영기준_ax-std-2026-003.md',
    'governance/l3-가이드라인/[가이드라인]_AX스킬라이브러리운영기준_ax-std-2026-003.md',
    '가이드라인', '[가이드라인]_AX 스킬 라이브러리 운영기준'],
  ['AX-STD-2026-004',
    'governance/operations/[운영방안]_AX토큰정책운영기준_ax-std-2026-004.md',
    'governance/l3-가이드라인/[가이드라인]_AX토큰정책운영기준_ax-std-2026-004.md',
    '가이드라인', '[가이드라인]_AX 토큰 정책 운영기준'],

  // 기존 가이드라인 — 타입 유지, 폴더만 이동
  ['AX-OPS-2026-001',
    'governance/operations/[가이드라인]_AI에이전트등록운영가이드_ax-ops-2026-001.md',
    'governance/l3-가이드라인/[가이드라인]_AI에이전트등록운영가이드_ax-ops-2026-001.md',
    '가이드라인', '[가이드라인]_AI 에이전트 등록·통제 지침'],
  ['AX-OPS-2026-002',
    'governance/operations/[가이드라인]_AI도구계정관리운영가이드_ax-ops-2026-002.md',
    'governance/l3-가이드라인/[가이드라인]_AI도구계정관리운영가이드_ax-ops-2026-002.md',
    '가이드라인', '[가이드라인]_전사 AI 도구 계정 관리 운영 가이드'],
  ['AX-OPS-2026-003',
    'governance/operations/[가이드라인]_생성형AI모델배분운영가이드_ax-ops-2026-003.md',
    'governance/l3-가이드라인/[가이드라인]_생성형AI모델배분운영가이드_ax-ops-2026-003.md',
    '가이드라인', '[가이드라인]_생성형 AI 모델 배분 기준 지침'],

  // 개발표준 → 가이드라인으로 타입 변경
  ['AX-DEV-2026-001',
    'governance/operations/[개발표준]_AI개발플로우추가조항_ax-dev-2026-001.md',
    'governance/l3-가이드라인/[가이드라인]_AI개발플로우추가조항_ax-dev-2026-001.md',
    '가이드라인', '[가이드라인]_AX팀 AI 개발·배포 플로우 추가 조항'],
  ['AX-DEV-2026-002',
    'governance/operations/[개발표준]_전사AI과제개발표준_ax-dev-2026-002.md',
    'governance/l3-가이드라인/[가이드라인]_전사AI과제개발표준_ax-dev-2026-002.md',
    '가이드라인', '[가이드라인]_AI 과제 개발 표준'],

  // 매뉴얼 — 이름의 가이드라인 제거
  ['AX-MAN-2026-001',
    'governance/full/[매뉴얼]_AI사용가이드라인_ax-man-2026-001.md',
    'governance/l3-매뉴얼/[매뉴얼]_AX허브사용안내_ax-man-2026-001.md',
    '매뉴얼', '[매뉴얼]_AX Request Hub 사용 안내'],
]

let ok = 0, err = 0
for (const [docId, oldRel, newRel, type, title] of CHANGES) {
  const oldAbs = path.join(DOCS_DIR, oldRel)
  const newAbs = path.join(DOCS_DIR, newRel)
  try {
    await rename(oldAbs, newAbs)
    await prisma.governanceDoc.update({
      where: { docId },
      data: { fileName: newRel, type, title },
    })
    console.log(`OK   ${docId}`)
    console.log(`     ${oldRel.split('/').pop()} → ${newRel.replace('governance/', '')}`)
    ok++
  } catch (e) {
    console.error(`ERR  ${docId}: ${e.message}`)
    err++
  }
}

console.log(`\n완료: ${ok}개 성공 / ${err}개 실패`)

// 검증
const all = await prisma.governanceDoc.findMany({
  select: { docId: true, type: true, fileName: true },
  orderBy: { docId: 'asc' },
})
console.log('\n--- 검증 ---')
for (const r of all) console.log(r.type.padEnd(6), r.docId, '|', r.fileName)

await prisma.$disconnect()
