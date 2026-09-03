/**
 * G코드 → 의미 기반 코드 마이그레이션 스크립트
 * 실행: npx tsx scripts/migrate-confidentiality.ts
 * 근거: AI운영지침 v1.6 (G1/G2/G3 코드 폐지)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CODE_MAP: Record<string, string> = {
  G1: 'PUBLIC',
  G2: 'RESTRICTED',
  G3: 'CONFIDENTIAL',
}

async function migrate() {
  console.log('기밀등급 코드 마이그레이션 시작...\n')

  for (const [old, next] of Object.entries(CODE_MAP)) {
    // Project.confidentialityLevel
    const p = await prisma.project.updateMany({
      where: { confidentialityLevel: old },
      data: { confidentialityLevel: next },
    })
    if (p.count) console.log(`Project.confidentialityLevel: ${old} → ${next} (${p.count}건)`)

    // DataAsset.classification
    const da = await (prisma as any).dataAsset?.updateMany?.({
      where: { classification: old },
      data: { classification: next },
    }).catch(() => ({ count: 0 })) ?? { count: 0 }
    if (da.count) console.log(`DataAsset.classification: ${old} → ${next} (${da.count}건)`)

    // DataRequest.classification
    const dr = await (prisma as any).dataRequest?.updateMany?.({
      where: { classification: old },
      data: { classification: next },
    }).catch(() => ({ count: 0 })) ?? { count: 0 }
    if (dr.count) console.log(`DataRequest.classification: ${old} → ${next} (${dr.count}건)`)

    // Skill.securityLevel
    const sk = await (prisma as any).skill?.updateMany?.({
      where: { securityLevel: old },
      data: { securityLevel: next },
    }).catch(() => ({ count: 0 })) ?? { count: 0 }
    if (sk.count) console.log(`Skill.securityLevel: ${old} → ${next} (${sk.count}건)`)

    // GovernanceDoc.securityLevel
    const gd = await (prisma as any).governanceDoc?.updateMany?.({
      where: { securityLevel: old },
      data: { securityLevel: next },
    }).catch(() => ({ count: 0 })) ?? { count: 0 }
    if (gd.count) console.log(`GovernanceDoc.securityLevel: ${old} → ${next} (${gd.count}건)`)
  }

  // 검증: G코드 잔존 확인
  console.log('\n── 잔존 검증 ──')
  for (const old of Object.keys(CODE_MAP)) {
    const remaining = await prisma.project.count({ where: { confidentialityLevel: old } })
    if (remaining > 0) {
      console.error(`⚠️  Project.confidentialityLevel에 ${old} ${remaining}건 잔존`)
    }
  }
  console.log('검증 완료\n')
}

migrate()
  .then(() => { console.log('마이그레이션 완료'); process.exit(0) })
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
