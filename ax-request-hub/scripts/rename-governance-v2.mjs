import { PrismaClient } from '@prisma/client'
import { rename } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = path.join(__dirname, '..', 'docs')
const prisma = new PrismaClient()

// [현재 fileName, 새 파일명(파일명만), subdir]
// 새 포맷: [type]_한국어이름_docid.md  (docId 소문자)
const RENAMES = [
  // full/
  { docId: 'AX-REG-2026-001', subdir: 'full',       newName: '[규정]_AI운영규정_ax-reg-2026-001.md' },
  { docId: 'AX-COM-2026-001', subdir: 'full',       newName: '[규정]_AI운영위원회규정_ax-com-2026-001.md' },
  { docId: 'AX-POL-2026-001', subdir: 'full',       newName: '[지침]_AI운영지침_ax-pol-2026-001.md' },
  { docId: 'AX-STD-2026-001', subdir: 'full',       newName: '[운영방안]_AI운영기준_ax-std-2026-001.md' },
  { docId: 'AX-MAN-2026-001', subdir: 'full',       newName: '[매뉴얼]_AI사용가이드라인_ax-man-2026-001.md' },
  // operations/
  { docId: 'AX-OPS-2026-001', subdir: 'operations', newName: '[가이드라인]_AI에이전트등록운영가이드_ax-ops-2026-001.md' },
  { docId: 'AX-OPS-2026-002', subdir: 'operations', newName: '[가이드라인]_AI도구계정관리운영가이드_ax-ops-2026-002.md' },
  { docId: 'AX-OPS-2026-003', subdir: 'operations', newName: '[가이드라인]_생성형AI모델배분운영가이드_ax-ops-2026-003.md' },
  { docId: 'AX-STD-2026-002', subdir: 'operations', newName: '[운영방안]_AI리터러시레벨운영기준_ax-std-2026-002.md' },
  { docId: 'AX-STD-2026-003', subdir: 'operations', newName: '[운영방안]_AX스킬라이브러리운영기준_ax-std-2026-003.md' },
  { docId: 'AX-STD-2026-004', subdir: 'operations', newName: '[운영방안]_AX토큰정책운영기준_ax-std-2026-004.md' },
  { docId: 'AX-DEV-2026-001', subdir: 'operations', newName: '[개발표준]_AI개발플로우추가조항_ax-dev-2026-001.md' },
  { docId: 'AX-DEV-2026-002', subdir: 'operations', newName: '[개발표준]_전사AI과제개발표준_ax-dev-2026-002.md' },
]

for (const { docId, subdir, newName } of RENAMES) {
  const rec = await prisma.governanceDoc.findUnique({ where: { docId }, select: { fileName: true } })
  if (!rec) { console.error(`NOT FOUND: ${docId}`); continue }

  const oldAbs = path.join(DOCS_DIR, rec.fileName)
  const newRel = `governance/${subdir}/${newName}`
  const newAbs = path.join(DOCS_DIR, newRel)

  try {
    await rename(oldAbs, newAbs)
    await prisma.governanceDoc.update({ where: { docId }, data: { fileName: newRel } })
    console.log(`OK  ${docId}`)
    console.log(`    → ${newName}`)
  } catch (e) {
    console.error(`ERR ${docId}: ${e.message}`)
  }
}

await prisma.$disconnect()
console.log('\n완료.')
