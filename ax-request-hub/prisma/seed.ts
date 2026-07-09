import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.employee.upsert({
    where: { email: "admin@samsungam.com" },
    update: {},
    create: {
      employeeId: "AX0001",
      name: "AX팀 관리자",
      email: "admin@samsungam.com",
      department: "AX/PI센터",
      jobTitle: "팀장",
      role: "AX_TEAM",
      currentLevel: "L4",
    },
  })

  await prisma.employee.upsert({
    where: { email: "test@samsungam.com" },
    update: {},
    create: {
      employeeId: "EMP0001",
      name: "테스트 직원",
      email: "test@samsungam.com",
      department: "운용본부",
      jobTitle: "과장",
      role: "EMPLOYEE",
      currentLevel: "L0",
    },
  })

  const l1Services = ["Gemini", "GPT for Excel"]
  const l2Services = ["GPT Enterprise", "Claude.ai"]
  const l3Services = ["Codex", "Claude Code", "Antigravity"]
  const l4Services = ["AI 격리환경", "AWS Bedrock"]

  const allPolicies = [
    ...l1Services.map((s) => ({ level: "L1", serviceName: s })),
    ...l2Services.map((s) => ({ level: "L2", serviceName: s })),
    ...l3Services.map((s) => ({ level: "L3", serviceName: s })),
    ...l4Services.map((s) => ({ level: "L4", serviceName: s })),
  ]

  for (const p of allPolicies) {
    await prisma.distributionPolicy.upsert({
      where: { level_serviceName: p },
      update: {},
      create: p,
    })
  }

  await prisma.tokenPolicy.upsert({
    where: { id: "company-all" },
    update: {},
    create: {
      id: "company-all",
      scope: "COMPANY",
      service: "all",
      monthlyLimit: 10000000,
      warningThreshold: 80,
    },
  })

  console.log("Seed 완료:", admin.name, "계정 생성됨")
}

main().catch(console.error).finally(() => prisma.$disconnect())
