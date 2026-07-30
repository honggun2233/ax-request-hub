import { PrismaClient } from '@prisma/client'
import { rename } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS_ROOT = path.join(__dirname, '..', 'docs', 'governance')

const prisma = new PrismaClient()

// { docId: [old relative path, new relative path] }
const RENAMES = [
  // full/
  ['AX-COM-2026-001', 'governance/full/AX-COMMITTEE-2026-001_AI운영위원회규정_v1.2.md',  'governance/full/AX-COM-2026-001_AI운영위원회규정.md'],
  ['AX-MAN-2026-001', 'governance/full/AX-MANUAL-2026-001_사용가이드라인.md',             'governance/full/AX-MAN-2026-001_AI사용가이드라인.md'],
  ['AX-POL-2026-001', 'governance/full/AX-POLICY-2026-001_AI운영지침_v6.5.md',            'governance/full/AX-POL-2026-001_AI운영지침.md'],
  ['AX-REG-2026-001', 'governance/full/AX-REGULATION-2026-001_AI운영규정_v4.0.md',        'governance/full/AX-REG-2026-001_AI운영규정.md'],
  ['AX-STD-2026-001', 'governance/full/AX-STANDARD-2026-001_AI운영기준_v1.1.md',          'governance/full/AX-STD-2026-001_AI운영기준.md'],
  // operations/
  ['AX-OPS-2026-001', 'governance/operations/AI에이전트등록_운영가이드.md',               'governance/operations/AX-OPS-2026-001_AI에이전트등록운영가이드.md'],
  ['AX-DEV-2026-001', 'governance/operations/AX_AI개발플로우_추가조항.md',                'governance/operations/AX-DEV-2026-001_AI개발플로우추가조항.md'],
  ['AX-OPS-2026-002', 'governance/operations/AX_AI도구계정_관리운영가이드.md',            'governance/operations/AX-OPS-2026-002_AI도구계정관리운영가이드.md'],
  ['AX-STD-2026-002', 'governance/operations/AX_AI리터러시레벨_운영기준.md',              'governance/operations/AX-STD-2026-002_AI리터러시레벨운영기준.md'],
  ['AX-DEV-2026-002', 'governance/operations/AX_개발표준_전사AI과제용.md',                'governance/operations/AX-DEV-2026-002_전사AI과제개발표준.md'],
  ['AX-STD-2026-003', 'governance/operations/AX_스킬라이브러리_운영기준.md',              'governance/operations/AX-STD-2026-003_AX스킬라이브러리운영기준.md'],
  ['AX-STD-2026-004', 'governance/operations/AX_토큰정책_운영기준.md',                   'governance/operations/AX-STD-2026-004_AX토큰정책운영기준.md'],
  ['AX-OPS-2026-003', 'governance/operations/생성형AI모델배분_운영가이드.md',             'governance/operations/AX-OPS-2026-003_생성형AI모델배분운영가이드.md'],
]

const DOCS_DIR = path.join(__dirname, '..', 'docs')

for (const [docId, oldRel, newRel] of RENAMES) {
  const oldAbs = path.join(DOCS_DIR, oldRel)
  const newAbs = path.join(DOCS_DIR, newRel)
  try {
    await rename(oldAbs, newAbs)
    await prisma.governanceDoc.update({
      where: { docId },
      data: { fileName: newRel },
    })
    console.log(`OK  ${docId}`)
    console.log(`    ${oldRel.split('/').pop()} → ${newRel.split('/').pop()}`)
  } catch (e) {
    console.error(`ERR ${docId}: ${e.message}`)
  }
}

const all = await prisma.governanceDoc.findMany({
  select: { docId: true, fileName: true },
  orderBy: { docId: 'asc' },
})
console.log('\n--- 검증 ---')
for (const r of all) console.log(r.docId, '|', r.fileName)

await prisma.$disconnect()
