import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// §2.3 초기 쿼터 배분 안 (부서장 이메일은 실제 배포 시 업데이트 필요)
const INITIAL_QUOTAS = [
  { department: 'AX/IT업무개발팀', toolType: 'GPT_CHAT',  totalQuota: 28, aiDensity: 'HIGH',     managedBy: '' },
  { department: '운용본부',         toolType: 'GPT_CHAT',  totalQuota: 56, aiDensity: 'HIGH',     managedBy: '' },
  { department: '전략기획/마케팅',  toolType: 'GPT_CHAT',  totalQuota: 16, aiDensity: 'MEDIUM',   managedBy: '' },
  { department: '전략기획/마케팅',  toolType: 'GEMINI',    totalQuota: 12, aiDensity: 'MEDIUM',   managedBy: '' },
  { department: '컴플라이언스/리스크', toolType: 'GPT_EXCEL', totalQuota: 28, aiDensity: 'MEDIUM', managedBy: '' },
  { department: '경영지원/재무/인사', toolType: 'GPT_EXCEL', totalQuota: 22, aiDensity: 'STANDARD', managedBy: '' },
  { department: '경영지원/재무/인사', toolType: 'GEMINI',   totalQuota: 8,  aiDensity: 'STANDARD', managedBy: '' },
  { department: '후선/기타',         toolType: 'GEMINI',   totalQuota: 30, aiDensity: 'STANDARD', managedBy: '' },
]

async function main() {
  console.log('AI 도구 초기 쿼터 시드 데이터 적재 중...')
  for (const q of INITIAL_QUOTAS) {
    await db.departmentQuota.upsert({
      where: { department_toolType: { department: q.department, toolType: q.toolType } },
      create: q,
      update: { totalQuota: q.totalQuota, aiDensity: q.aiDensity },
    })
    console.log(`  ✓ ${q.department} / ${q.toolType} → ${q.totalQuota}석`)
  }
  const total = INITIAL_QUOTAS.reduce((s, q) => s + q.totalQuota, 0)
  console.log(`\n완료 — 총 ${total}석 배분 (한도: 200석)`)
}

main().catch(console.error).finally(() => db.$disconnect())
