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

  const literacyCourses = [
    { title: '생성형 AI 개론', level: '기초', description: 'AI 기본 개념과 활용', durationMin: 60, isRequired: true },
    { title: 'AI 윤리와 보안', level: '기초', description: '데이터 보안 및 AI 윤리', durationMin: 45, isRequired: true },
    { title: 'ChatGPT 업무 활용', level: '기초', description: '실무 활용법', durationMin: 90, isRequired: false },
  ]
  for (const course of literacyCourses) {
    const existing = await prisma.literacyCourse.findFirst({ where: { title: course.title } })
    if (!existing) await prisma.literacyCourse.create({ data: course })
  }

  console.log("Seed 완료:", admin.name, "계정 생성됨")
}

main().catch(console.error).finally(() => prisma.$disconnect())
