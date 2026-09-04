/**
 * Policy Gateway 전용 TokenPolicy 시드
 * service='ALL': 전사 통합 사용량 기준 (서비스 무관)
 * checkQuota는 서비스별 행 참조 — 이 행과 혼용 없음
 *
 * Run: npx tsx scripts/seed-policy-gateway-token-policy.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // COMPANY 통합 기본 정책 (레벨별 정책이 없으면 이 행으로 폴백)
  const company = await prisma.tokenPolicy.upsert({
    where: { id: 'policy-gateway-company-all' },
    create: {
      id: 'policy-gateway-company-all',
      scope: 'COMPANY',
      service: 'ALL',
      monthlyLimit: 500_000,   // 토큰 기준 — 실제 값은 관리자 UI에서 조정
      warningThreshold: 80,
      isActive: true,
    },
    update: { isActive: true },
  })
  console.log(`COMPANY/ALL 정책 등록: id=${company.id}, limit=${company.monthlyLimit}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
