import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // ── 직원 10명 ──
  const employees = [
    { employeeId: "AX0001", name: "홍인표", email: "admin@samsungam.com", department: "AX/PI센터", jobTitle: "팀장", role: "AX_TEAM", currentLevel: "L4" },
    { employeeId: "AX0002", name: "김지수", email: "jskim@samsungam.com", department: "AX/PI센터", jobTitle: "선임", role: "AX_TEAM", currentLevel: "L3" },
    { employeeId: "EMP0001", name: "이민준", email: "test@samsungam.com", department: "운용본부", jobTitle: "과장", role: "EMPLOYEE", currentLevel: "L2" },
    { employeeId: "EMP0002", name: "박서연", email: "sypark@samsungam.com", department: "운용본부", jobTitle: "대리", role: "EMPLOYEE", currentLevel: "L1" },
    { employeeId: "EMP0003", name: "최재원", email: "jwchoi@samsungam.com", department: "리스크관리팀", jobTitle: "차장", role: "MANAGER", currentLevel: "L2" },
    { employeeId: "EMP0004", name: "정수연", email: "syjung@samsungam.com", department: "준법감시팀", jobTitle: "과장", role: "EMPLOYEE", currentLevel: "L1" },
    { employeeId: "EMP0005", name: "한도윤", email: "dyhan@samsungam.com", department: "IT업무개발팀", jobTitle: "선임", role: "EMPLOYEE", currentLevel: "L3" },
    { employeeId: "EMP0006", name: "윤채원", email: "cwYoon@samsungam.com", department: "마케팅팀", jobTitle: "대리", role: "EMPLOYEE", currentLevel: "L0" },
    { employeeId: "EMP0007", name: "강민서", email: "mskang@samsungam.com", department: "경영기획팀", jobTitle: "과장", role: "EMPLOYEE", currentLevel: "L1" },
    { employeeId: "EMP0008", name: "오현석", email: "hsoh@samsungam.com", department: "데이터플랫폼팀", jobTitle: "차장", role: "MANAGER", currentLevel: "L3" },
    { employeeId: "TST0001", name: "부서장테스트", email: "dept@samsungam.com", department: "운용본부", jobTitle: "팀장", role: "DEPT_HEAD", currentLevel: "L3" },
    { employeeId: "TST0002", name: "경영진테스트", email: "exec@samsungam.com", department: "경영기획팀", jobTitle: "본부장", role: "EXECUTIVE", currentLevel: "L4" },
    { employeeId: "TST0003", name: "데이터플랫폼테스트", email: "dp@samsungam.com", department: "데이터플랫폼팀", jobTitle: "선임", role: "DATA_PLATFORM", currentLevel: "L3" },
  ]

  const createdEmployees: Record<string, any> = {}
  for (const emp of employees) {
    const e = await prisma.employee.upsert({
      where: { email: emp.email },
      update: { currentLevel: emp.currentLevel, role: emp.role },
      create: emp,
    })
    createdEmployees[emp.email] = e
  }

  // ── 서비스 배분 정책 ──
  const policies = [
    { level: "L1", serviceName: "Gemini" },
    { level: "L1", serviceName: "GPT for Excel" },
    { level: "L2", serviceName: "GPT Enterprise" },
    { level: "L2", serviceName: "Claude.ai" },
    { level: "L3", serviceName: "Codex" },
    { level: "L3", serviceName: "Claude Code" },
    { level: "L3", serviceName: "Antigravity" },
    { level: "L4", serviceName: "AI 격리환경" },
    { level: "L4", serviceName: "AWS Bedrock" },
  ]
  const createdPolicies: Record<string, any> = {}
  for (const p of policies) {
    const policy = await prisma.distributionPolicy.upsert({
      where: { level_serviceName: p },
      update: {},
      create: p,
    })
    createdPolicies[`${p.level}_${p.serviceName}`] = policy
  }

  // ── 서비스 배분 (직원별) ──
  const adminId = createdEmployees["admin@samsungam.com"].id
  const allocations = [
    { email: "admin@samsungam.com", services: ["Gemini", "GPT Enterprise", "Claude Code", "AI 격리환경", "AWS Bedrock"] },
    { email: "jskim@samsungam.com", services: ["Gemini", "GPT Enterprise", "Claude Code", "Antigravity"] },
    { email: "test@samsungam.com", services: ["Gemini", "GPT Enterprise", "Claude.ai"] },
    { email: "sypark@samsungam.com", services: ["Gemini", "GPT for Excel"] },
    { email: "jwchoi@samsungam.com", services: ["Gemini", "GPT Enterprise"] },
    { email: "syjung@samsungam.com", services: ["Gemini"] },
    { email: "dyhan@samsungam.com", services: ["Gemini", "GPT Enterprise", "Claude Code"] },
    { email: "mskang@samsungam.com", services: ["Gemini", "GPT for Excel"] },
    { email: "hsoh@samsungam.com", services: ["Gemini", "GPT Enterprise", "Antigravity"] },
  ]
  for (const a of allocations) {
    const emp = createdEmployees[a.email]
    if (!emp) continue
    for (const svc of a.services) {
      const level = policies.find(p => p.serviceName === svc)?.level ?? "L1"
      const policy = createdPolicies[`${level}_${svc}`]
      if (!policy) continue
      const existing = await prisma.serviceAllocation.findFirst({
        where: { employeeId: emp.id, policyId: policy.id, status: "ACTIVE" }
      })
      if (!existing) {
        await prisma.serviceAllocation.create({
          data: { employeeId: emp.id, policyId: policy.id, grantedById: adminId, status: "ACTIVE" }
        })
      }
    }
  }

  // ── 토큰 정책 ──
  await prisma.tokenPolicy.upsert({
    where: { id: "company-all" },
    update: {},
    create: { id: "company-all", scope: "COMPANY", service: "all", monthlyLimit: 50000000, warningThreshold: 80 },
  })

  // ── 토큰 사용 기록 (6개월치) ──
  const months = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]
  const usageData = [
    { email: "admin@samsungam.com", service: "Claude Code", usage: [120000, 180000, 210000, 250000, 310000, 280000] },
    { email: "admin@samsungam.com", service: "Gemini", usage: [30000, 45000, 50000, 60000, 55000, 70000] },
    { email: "jskim@samsungam.com", service: "Claude Code", usage: [80000, 95000, 110000, 130000, 160000, 145000] },
    { email: "test@samsungam.com", service: "GPT Enterprise", usage: [50000, 60000, 75000, 90000, 85000, 95000] },
    { email: "test@samsungam.com", service: "Claude.ai", usage: [20000, 30000, 35000, 40000, 55000, 48000] },
    { email: "jwchoi@samsungam.com", service: "GPT Enterprise", usage: [40000, 55000, 65000, 70000, 80000, 75000] },
    { email: "dyhan@samsungam.com", service: "Claude Code", usage: [60000, 90000, 120000, 140000, 180000, 165000] },
    { email: "hsoh@samsungam.com", service: "GPT Enterprise", usage: [35000, 48000, 55000, 65000, 72000, 68000] },
  ]
  for (const u of usageData) {
    const emp = createdEmployees[u.email]
    if (!emp) continue
    for (let i = 0; i < months.length; i++) {
      await prisma.usageRecord.upsert({
        where: { employeeId_service_yearMonth: { employeeId: emp.id, service: u.service, yearMonth: months[i] } },
        update: { tokenUsed: u.usage[i] },
        create: { employeeId: emp.id, service: u.service, yearMonth: months[i], tokenUsed: u.usage[i], costKrw: u.usage[i] * 0.002, inputById: adminId },
      })
    }
  }

  // ── 레벨 신청 ──
  const applications = [
    { email: "sypark@samsungam.com", requestedLevel: "L2", currentLevel: "L1", status: "PENDING", selfIntro: "1년간 L1 서비스로 보고서 자동화 업무에 활용했습니다.", trainingCompleted: "생성형 AI 개론, AI 윤리와 보안 수료", utilizationPlan: "GPT Enterprise로 운용 분석 리포트 작성 자동화 예정" },
    { email: "mskang@samsungam.com", requestedLevel: "L2", currentLevel: "L1", status: "PENDING", selfIntro: "경영기획 업무에서 Excel GPT를 6개월 사용했습니다.", trainingCompleted: "생성형 AI 개론 수료", utilizationPlan: "Claude.ai로 경영 보고서 초안 작성 활용 계획" },
    { email: "jwchoi@samsungam.com", requestedLevel: "L3", currentLevel: "L2", status: "APPROVED", selfIntro: "리스크 모델링에 GPT Enterprise를 2년간 사용했습니다.", trainingCompleted: "전 과정 수료", utilizationPlan: "Codex로 리스크 계산 자동화 코드 작성" },
    { email: "syjung@samsungam.com", requestedLevel: "L2", currentLevel: "L1", status: "REJECTED", selfIntro: "준법감시 업무에서 AI 활용 경험 있습니다.", trainingCompleted: "기초과정만 수료", utilizationPlan: "미정", reviewNote: "활용계획이 구체적이지 않습니다. 보완 후 재신청 바랍니다." },
  ]
  for (const app of applications) {
    const emp = createdEmployees[app.email]
    if (!emp) continue
    const existing = await prisma.levelApplication.findFirst({ where: { employeeId: emp.id, requestedLevel: app.requestedLevel } })
    if (!existing) {
      await prisma.levelApplication.create({
        data: {
          employeeId: emp.id,
          requestedLevel: app.requestedLevel,
          currentLevel: app.currentLevel,
          selfIntro: app.selfIntro,
          trainingCompleted: app.trainingCompleted,
          utilizationPlan: app.utilizationPlan,
          status: app.status,
          reviewNote: app.reviewNote ?? "",
          reviewedById: app.status !== "PENDING" ? adminId : null,
          reviewedAt: app.status !== "PENDING" ? new Date() : null,
        }
      })
    }
  }

  // ── AI 과제 (Project) ──
  const projects = [
    { title: "STT 회의록 자동 변환", department: "IT업무개발팀", requesterName: "한도윤", requesterEmail: "dyhan@samsungam.com", description: "회의 음성을 텍스트로 변환해 회의록 자동 생성", asIs: "수작업으로 회의록 작성, 시간 2시간 소요", expectedBenefit: "회의록 작성 시간 90% 절감", confidentialityLevel: "G1", estimatedUsers: 50, status: "production", totalScore: 88, autoApproved: true },
    { title: "고객 문의 자동 분류", department: "고객지원팀", requesterName: "박서연", requesterEmail: "sypark@samsungam.com", description: "AI로 고객 문의를 자동 분류하고 답변 초안 생성", asIs: "담당자가 수동으로 분류, 응답 지연 발생", expectedBenefit: "응답 속도 60% 향상", confidentialityLevel: "G2", estimatedUsers: 20, status: "pilot", totalScore: 91, autoApproved: true },
    { title: "펀드 공시 문서 자동화", department: "준법감시팀", requesterName: "정수연", requesterEmail: "syjung@samsungam.com", description: "펀드 정기 공시 문서 초안 자동 생성", asIs: "전문 인력이 수작업으로 작성, 오류 발생", expectedBenefit: "작성 시간 70% 단축, 오류율 감소", confidentialityLevel: "G3", estimatedUsers: 10, status: "evaluated", totalScore: 79, autoApproved: false },
    { title: "리스크 리포트 자동 생성", department: "리스크관리팀", requesterName: "최재원", requesterEmail: "jwchoi@samsungam.com", description: "일일 리스크 지표를 자동 수집해 보고서 생성", asIs: "매일 2시간 소요, 주말 미생성", expectedBenefit: "리스크 모니터링 24/7 자동화", confidentialityLevel: "G2", estimatedUsers: 15, status: "submitted", totalScore: 82, autoApproved: true },
    { title: "투자설명서 초안 작성", department: "운용본부", requesterName: "이민준", requesterEmail: "test@samsungam.com", description: "신규 펀드 투자설명서 AI 초안 생성", asIs: "법무팀과 협의해 수주일 소요", expectedBenefit: "초안 작성 기간 50% 단축", confidentialityLevel: "G3", estimatedUsers: 8, status: "submitted", totalScore: 58, autoApproved: false },
    { title: "ESG 리포트 데이터 수집", department: "리서치팀", requesterName: "오현석", requesterEmail: "hsoh@samsungam.com", description: "외부 ESG 데이터 자동 수집 및 정제", asIs: "수동 크롤링으로 주 1회 업데이트", expectedBenefit: "일일 자동 업데이트, 데이터 정확도 향상", confidentialityLevel: "G2", estimatedUsers: 30, status: "pilot", totalScore: 65, autoApproved: false },
    { title: "신규 직원 온보딩 챗봇", department: "HR팀", requesterName: "강민서", requesterEmail: "mskang@samsungam.com", description: "신입 직원을 위한 AI 챗봇 온보딩 시스템", asIs: "HR 담당자가 개별 안내, 반복 질문 많음", expectedBenefit: "온보딩 기간 2주→1주 단축", confidentialityLevel: "G1", estimatedUsers: 100, status: "production", totalScore: 74, autoApproved: true },
    { title: "월간 경영 보고서 자동화", department: "경영기획팀", requesterName: "강민서", requesterEmail: "mskang@samsungam.com", description: "월간 KPI 데이터를 취합해 보고서 초안 생성", asIs: "기획팀 3명이 1주일 소요", expectedBenefit: "보고서 작성 시간 80% 절감", confidentialityLevel: "G2", estimatedUsers: 5, status: "closed", totalScore: 71, autoApproved: true },
  ]

  for (const p of projects) {
    const existing = await prisma.project.findFirst({ where: { title: p.title } })
    if (!existing) {
      const proj = await prisma.project.create({
        data: {
          title: p.title, department: p.department,
          requesterName: p.requesterName, requesterEmail: p.requesterEmail,
          description: p.description, asIs: p.asIs, expectedBenefit: p.expectedBenefit,
          confidentialityLevel: p.confidentialityLevel, estimatedUsers: p.estimatedUsers,
          status: p.status, totalScore: p.totalScore, autoApproved: p.autoApproved,
          source: "user_request",
        }
      })
      if (p.totalScore) {
        await prisma.scoreCard.create({
          data: {
            projectId: proj.id,
            impactScore: p.totalScore * 0.25,
            roiScore: p.totalScore * 0.25,
            confidentialityScore: p.confidentialityLevel === "G1" ? 15 : p.confidentialityLevel === "G2" ? 10 : 5,
            difficultyScore: p.totalScore * 0.15,
            readinessScore: p.totalScore * 0.10,
            strategyScore: p.totalScore * 0.10,
            totalScore: p.totalScore,
            evaluationRationale: `AI 자동 평가 완료. 총점 ${p.totalScore}점.`,
          }
        })
      }
    }
  }

  // ── 리터러시 과정 ──
  const courses = [
    { title: "생성형 AI 개론", level: "기초", description: "ChatGPT·Gemini 등 생성형 AI 기본 개념과 업무 활용법", durationMin: 60, isRequired: true },
    { title: "AI 윤리와 보안", level: "기초", description: "AI 사용 시 데이터 보안·개인정보 보호·윤리 기준", durationMin: 45, isRequired: true },
    { title: "ChatGPT 업무 활용", level: "기초", description: "실무 프롬프트 작성, 보고서·이메일 자동화 실습", durationMin: 90, isRequired: false },
    { title: "Claude API 연동", level: "중급", description: "Claude API를 활용한 업무 자동화 파이프라인 구축", durationMin: 120, isRequired: false },
    { title: "프롬프트 엔지니어링", level: "중급", description: "Chain-of-thought, few-shot, RAG 기법 실습", durationMin: 90, isRequired: false },
    { title: "AI 에이전트 설계", level: "고급", description: "멀티에이전트 시스템 설계 및 오케스트레이션", durationMin: 180, isRequired: false },
  ]
  for (const c of courses) {
    const existing = await prisma.literacyCourse.findFirst({ where: { title: c.title } })
    if (!existing) await prisma.literacyCourse.create({ data: c })
  }

  // ── 수강 기록 ──
  const enrollments = [
    { email: "admin@samsungam.com", courses: ["생성형 AI 개론", "AI 윤리와 보안", "ChatGPT 업무 활용", "Claude API 연동", "AI 에이전트 설계"] },
    { email: "jskim@samsungam.com", courses: ["생성형 AI 개론", "AI 윤리와 보안", "프롬프트 엔지니어링"] },
    { email: "test@samsungam.com", courses: ["생성형 AI 개론", "AI 윤리와 보안"] },
    { email: "sypark@samsungam.com", courses: ["생성형 AI 개론"] },
    { email: "dyhan@samsungam.com", courses: ["생성형 AI 개론", "AI 윤리와 보안", "ChatGPT 업무 활용"] },
  ]
  for (const en of enrollments) {
    const emp = createdEmployees[en.email]
    if (!emp) continue
    for (const courseTitle of en.courses) {
      const course = await prisma.literacyCourse.findFirst({ where: { title: courseTitle } })
      if (!course) continue
      const existing = await prisma.literacyEnrollment.findUnique({ where: { employeeId_courseId: { employeeId: emp.id, courseId: course.id } } })
      if (!existing) {
        await prisma.literacyEnrollment.create({
          data: { employeeId: emp.id, courseId: course.id, status: "COMPLETED", completedAt: new Date(), score: Math.floor(Math.random() * 20) + 80 }
        })
      }
    }
  }

  // ── 에이전트 (총 7개: ACTIVE 3, DEPRECATED 2, RETIRED 2) ──
  const agentDefs = [
    { name: "ETF 상품 추천 에이전트", department: "AX/PI센터", description: "앙상블 기반 ETF 신상품 추천 파이프라인 — 11개 서브에이전트 오케스트레이션", status: "ACTIVE", deprecatedAt: null, retiredAt: null, deprecationReason: null, retirementNote: null },
    { name: "공시 문서 분류 에이전트", department: "준법감시팀", description: "DART 공시 문서 자동 분류 및 핵심 내용 요약", status: "ACTIVE", deprecatedAt: null, retiredAt: null, deprecationReason: null, retirementNote: null },
    { name: "리스크 모니터링 에이전트", department: "리스크관리팀", description: "일일 포트폴리오 리스크 지표 자동 수집 및 임계값 알림", status: "ACTIVE", deprecatedAt: null, retiredAt: null, deprecationReason: null, retirementNote: null },
    { name: "고객 문의 분류 에이전트", department: "고객지원팀", description: "고객 문의 카테고리 자동 분류 (v1, 정확도 62%)", status: "DEPRECATED", deprecatedAt: new Date("2026-06-01"), retiredAt: null, deprecationReason: "DUPLICATE", retirementNote: "고객지원시스템 내장 ML 분류기로 대체. 30일 유예 기간 진행 중." },
    { name: "NAV 계산 에이전트 v1", department: "운용본부", description: "펀드 NAV 일일 자동 계산 (구버전, 소수점 처리 버그)", status: "DEPRECATED", deprecatedAt: new Date("2026-05-15"), retiredAt: null, deprecationReason: "PERFORMANCE", retirementNote: "NAV 계산 에이전트 v2로 교체. 소수점 6자리 정밀도 문제 해결됨." },
    { name: "리포트 초안 에이전트 v1", department: "리서치팀", description: "월간 리서치 리포트 초안 생성 (구버전, GPT-3.5 기반)", status: "RETIRED", deprecatedAt: new Date("2026-04-01"), retiredAt: new Date("2026-05-01"), deprecationReason: "SCOPE_CHANGE", retirementNote: "Claude 3 기반 v2로 전면 재작성. v1 산출물 3년 보관." },
    { name: "KYC 문서 검증 에이전트", department: "준법감시팀", description: "고객 KYC 문서 자동 검증 및 위험도 분류", status: "RETIRED", deprecatedAt: new Date("2026-03-01"), retiredAt: new Date("2026-04-01"), deprecationReason: "POLICY_CHANGE", retirementNote: "금감원 AI 의사결정 가이드라인 개정으로 인해 인간 검토 의무화. 완전 폐기." },
  ]
  const createdAgents: Record<string, any> = {}
  for (const a of agentDefs) {
    const existing = await prisma.agent.findFirst({ where: { name: a.name } })
    const agent = existing ?? await prisma.agent.create({ data: a })
    createdAgents[a.name] = agent
  }

  // ── AgentArtifact (폐기/은퇴 에이전트 산출물) ──
  const artifactDefs = [
    // 고객 문의 분류 에이전트 (DEPRECATED) 산출물
    { agentName: "고객 문의 분류 에이전트", artifactType: "PROMPT_TEMPLATE", title: "고객 문의 분류 시스템 프롬프트 v3.2", contentPath: "/artifacts/cust-classify/system-prompt-v3.2.md", retainUntil: new Date("2029-06-01"), archived: false },
    { agentName: "고객 문의 분류 에이전트", artifactType: "TRAINING_DATA", title: "분류 학습 데이터셋 (2024-2026, 12,400건)", contentPath: "/artifacts/cust-classify/training-dataset-2024-2026.jsonl", retainUntil: new Date("2029-06-01"), archived: false },
    { agentName: "고객 문의 분류 에이전트", artifactType: "EVALUATION_REPORT", title: "정확도 평가 리포트 (최종: 62.3%)", contentPath: "/artifacts/cust-classify/eval-report-final.pdf", retainUntil: new Date("2029-06-01"), archived: false },
    // NAV 계산 에이전트 v1 (DEPRECATED) 산출물
    { agentName: "NAV 계산 에이전트 v1", artifactType: "PROMPT_TEMPLATE", title: "NAV 계산 로직 프롬프트 (소수점 버그 포함)", contentPath: "/artifacts/nav-v1/nav-prompt-bugged.md", retainUntil: new Date("2029-05-15"), archived: false },
    { agentName: "NAV 계산 에이전트 v1", artifactType: "BUG_REPORT", title: "소수점 6자리 정밀도 이슈 분석 리포트", contentPath: "/artifacts/nav-v1/bug-report-decimal.md", retainUntil: new Date("2029-05-15"), archived: false },
    // 리포트 초안 에이전트 v1 (RETIRED) 산출물
    { agentName: "리포트 초안 에이전트 v1", artifactType: "PROMPT_TEMPLATE", title: "월간 리포트 생성 프롬프트 세트 (GPT-3.5)", contentPath: "/artifacts/report-v1/prompts-gpt35.md", retainUntil: new Date("2029-05-01"), archived: true },
    { agentName: "리포트 초안 에이전트 v1", artifactType: "OUTPUT_SAMPLE", title: "2024~2025 월간 리포트 초안 아카이브 (24개월)", contentPath: "/artifacts/report-v1/monthly-reports-2024-2025.zip", retainUntil: new Date("2029-05-01"), archived: true },
    { agentName: "리포트 초안 에이전트 v1", artifactType: "EVALUATION_REPORT", title: "최종 성능 평가 (BLEU 0.61, ROUGE-L 0.54)", contentPath: "/artifacts/report-v1/eval-final.pdf", retainUntil: new Date("2029-05-01"), archived: true },
    // KYC 문서 검증 에이전트 (RETIRED) 산출물
    { agentName: "KYC 문서 검증 에이전트", artifactType: "POLICY_DOCUMENT", title: "금감원 가이드라인 대응 분석서", contentPath: "/artifacts/kyc/fsc-guideline-analysis.pdf", retainUntil: new Date("2029-04-01"), archived: true },
    { agentName: "KYC 문서 검증 에이전트", artifactType: "TRAINING_DATA", title: "KYC 검증 학습 데이터 (개인정보 마스킹 처리)", contentPath: "/artifacts/kyc/training-masked.jsonl", retainUntil: new Date("2029-04-01"), archived: true },
    { agentName: "KYC 문서 검증 에이전트", artifactType: "OUTPUT_SAMPLE", title: "검증 결과 샘플 100건 (비식별화)", contentPath: "/artifacts/kyc/output-samples-deidentified.csv", retainUntil: new Date("2029-04-01"), archived: true },
  ]
  for (const art of artifactDefs) {
    const agent = createdAgents[art.agentName]
    if (!agent) continue
    const existing = await prisma.agentArtifact.findFirst({ where: { agentId: agent.id, title: art.title } })
    if (!existing) {
      await prisma.agentArtifact.create({ data: { agentId: agent.id, artifactType: art.artifactType, title: art.title, contentPath: art.contentPath, retainUntil: art.retainUntil, archived: art.archived } })
    }
  }

  // ── AgentKnowledgeExtract (폐기/은퇴 에이전트 지식 추출) ──
  const knowledgeDefs = [
    {
      agentName: "리포트 초안 에이전트 v1",
      promptPatterns: "시스템 프롬프트에 '삼성자산운용 투자전략 보고서 양식'을 명시할 때 포맷 일관성 +23%\n'단락 길이 3~5문장'으로 제약 시 가독성 점수 향상",
      failureCases: "1. 시황 데이터 없이 미래 전망 요청 → 근거 없는 추측성 문장 생성 (12건)\n2. 테이블 형식 요청 시 마크다운 미지원 → 서식 깨짐 (7건)",
      useCaseSummary: "월간 리서치 리포트 초안 24개월 생성. 평균 작성 시간 3시간 → 45분으로 단축. 담당자 교정 후 배포.",
      lessonsLearned: "GPT-3.5는 복잡한 금융 지표 해석에서 오류율 높음. Claude 3 마이그레이션 시 시스템 프롬프트에 도메인 용어집 포함 필수.",
      extractedBy: "admin@samsungam.com",
    },
    {
      agentName: "KYC 문서 검증 에이전트",
      promptPatterns: "체크리스트 형식 프롬프트(Y/N 판단)가 서술형 대비 정확도 +18%\n'불확실한 경우 반드시 인간 검토 요청'을 명시하면 오탐률 -31%",
      failureCases: "1. 손글씨 포함 서류 → OCR 오류로 판단 불가 (전체 8%)\n2. 외국어 주소 포함 여권 → 검증 로직 우회 (3건)",
      useCaseSummary: "14개월간 KYC 문서 3,200건 자동 검증. 인간 검토 시간 60% 단축. 금감원 AI 가이드라인 개정으로 2026-04 완전 폐기.",
      lessonsLearned: "규제 환경 변화에 취약한 에이전트. 도입 전 법무·준법감시 사전 검토 필수. AI 의사결정 인간 Override 메커니즘은 설계 단계부터 포함할 것.",
      extractedBy: "jskim@samsungam.com",
    },
    {
      agentName: "고객 문의 분류 에이전트",
      promptPatterns: "카테고리 목록을 프롬프트에 열거할 때 분류 정확도 +15%\nFew-shot 예시 3개 제공 시 엣지케이스 처리 개선",
      failureCases: "1. 복합 민원(여러 카테고리 혼재) → 단일 분류 강제로 오분류 (17%)\n2. 은어·비속어 포함 문의 → 분류 거부 (5건)",
      useCaseSummary: "8개월 운영, 일평균 340건 분류. 정확도 62.3% (목표 80% 미달). 고객지원팀 내장 ML 분류기(정확도 81%)로 대체 결정.",
      lessonsLearned: "LLM 기반 분류는 초기 빠른 구축에 유리하나 대용량 반복 작업은 전통 ML 대비 비용 효율 낮음. 정확도 목표 미달 시 fallback 설계 필수.",
      extractedBy: "admin@samsungam.com",
    },
  ]
  for (const kn of knowledgeDefs) {
    const agent = createdAgents[kn.agentName]
    if (!agent) continue
    const existing = await prisma.agentKnowledgeExtract.findFirst({ where: { agentId: agent.id } })
    if (!existing) {
      await prisma.agentKnowledgeExtract.create({ data: { agentId: agent.id, promptPatterns: kn.promptPatterns, failureCases: kn.failureCases, useCaseSummary: kn.useCaseSummary, lessonsLearned: kn.lessonsLearned, extractedBy: kn.extractedBy } })
    }
  }

  // ── LevelHistory (레벨 변경 이력) ──
  const adminEmp = createdEmployees["admin@samsungam.com"]
  const levelHistories = [
    { email: "test@samsungam.com", fromLevel: "L1", toLevel: "L2", reason: "L1 서비스 6개월 이상 활용, 운용 분석 리포트 자동화 성과 인정" },
    { email: "jwchoi@samsungam.com", fromLevel: "L1", toLevel: "L2", reason: "리스크 모델링 GPT 활용 성과 우수" },
    { email: "jwchoi@samsungam.com", fromLevel: "L2", toLevel: "L3", reason: "리스크 계산 자동화 코드 작성 역량 검증 완료" },
    { email: "dyhan@samsungam.com", fromLevel: "L2", toLevel: "L3", reason: "AI 포털 개발 기여, 코딩 역량 AX팀 검증" },
    { email: "jskim@samsungam.com", fromLevel: "L2", toLevel: "L3", reason: "AX팀 선임 — 프롬프트 엔지니어링 전문성 확인" },
  ]
  for (const lh of levelHistories) {
    const emp = createdEmployees[lh.email]
    if (!emp) continue
    const existing = await prisma.levelHistory.findFirst({ where: { employeeId: emp.id, fromLevel: lh.fromLevel, toLevel: lh.toLevel } })
    if (!existing) {
      await prisma.levelHistory.create({ data: { employeeId: emp.id, fromLevel: lh.fromLevel, toLevel: lh.toLevel, reason: lh.reason, changedById: adminEmp.id, createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000) } })
    }
  }

  // ── UsageAlert (추가) ──
  const alertDefs = [
    { email: "dyhan@samsungam.com", service: "Claude Code", yearMonth: "2026-07", alertType: "WARNING_80" },
    { email: "admin@samsungam.com", service: "Claude Code", yearMonth: "2026-06", alertType: "WARNING_80" },
    { email: "jskim@samsungam.com", service: "Claude Code", yearMonth: "2026-06", alertType: "WARNING_80" },
    { email: "test@samsungam.com", service: "GPT Enterprise", yearMonth: "2026-07", alertType: "WARNING_80" },
  ]
  for (const al of alertDefs) {
    const emp = createdEmployees[al.email]
    if (!emp) continue
    const existing = await prisma.usageAlert.findFirst({ where: { employeeId: emp.id, service: al.service, yearMonth: al.yearMonth } })
    if (!existing) {
      await prisma.usageAlert.create({ data: { employeeId: emp.id, service: al.service, yearMonth: al.yearMonth, alertType: al.alertType, acknowledged: false } })
    }
  }

  // ── 감사 로그 ──
  const auditLogs = [
    { entityType: "PROJECT", entityId: "p1", action: "AUTO_APPROVED", actorEmail: "system@samsungam.com", detail: "STT 회의록 자동 변환 — 총점 88점, 자동 승인" },
    { entityType: "PROJECT", entityId: "p2", action: "AUTO_APPROVED", actorEmail: "system@samsungam.com", detail: "고객 문의 자동 분류 — 총점 91점, 자동 승인" },
    { entityType: "PROJECT", entityId: "p3", action: "ESCALATED", actorEmail: "system@samsungam.com", detail: "투자설명서 초안 작성 — G3 기밀등급, AX팀장 에스컬레이션" },
    { entityType: "LEVEL_APPLICATION", entityId: "la1", action: "LEVEL_GRANTED", actorEmail: "admin@samsungam.com", detail: "최재원 L2→L3 승급 승인" },
    { entityType: "LEVEL_APPLICATION", entityId: "la2", action: "LEVEL_REJECTED", actorEmail: "admin@samsungam.com", detail: "정수연 L1→L2 신청 반려 — 활용계획 미흡" },
    { entityType: "AGENT", entityId: "a1", action: "AGENT_DEPRECATED", actorEmail: "admin@samsungam.com", detail: "고객 문의 분류 에이전트 폐기 시작 — 중복 사유" },
    { entityType: "TOKEN", entityId: "t1", action: "TOKEN_LIMIT_WARNING", actorEmail: "system@samsungam.com", detail: "한도윤 Claude Code 사용량 85% 도달 경고" },
    { entityType: "PROJECT", entityId: "p4", action: "AUTO_APPROVED", actorEmail: "system@samsungam.com", detail: "신규 직원 온보딩 챗봇 — 총점 74점, 자동 승인" },
  ]
  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: { ...log, createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) } })
  }

  // ── 감사 로그 추가 (에이전트 관련) ──
  const agentAuditLogs = [
    { entityType: "AGENT", entityId: "a2", action: "AGENT_DEPRECATED", actorEmail: "admin@samsungam.com", detail: "NAV 계산 에이전트 v1 — 소수점 정밀도 버그로 폐기, v2로 대체" },
    { entityType: "AGENT", entityId: "a3", action: "AGENT_RETIRED", actorEmail: "jskim@samsungam.com", detail: "리포트 초안 에이전트 v1 — 30일 유예 완료, 산출물 3건 아카이브" },
    { entityType: "AGENT", entityId: "a4", action: "AGENT_RETIRED", actorEmail: "admin@samsungam.com", detail: "KYC 문서 검증 에이전트 — 금감원 가이드라인 개정으로 강제 폐기" },
    { entityType: "AGENT", entityId: "a5", action: "KNOWLEDGE_EXTRACTED", actorEmail: "admin@samsungam.com", detail: "리포트 초안 에이전트 v1 지식 추출 완료 — 프롬프트 패턴 5개, 실패 사례 2개 문서화" },
    { entityType: "AGENT", entityId: "a6", action: "KNOWLEDGE_EXTRACTED", actorEmail: "jskim@samsungam.com", detail: "KYC 문서 검증 에이전트 지식 추출 완료 — 규제 리스크 교훈 포함" },
  ]
  for (const log of agentAuditLogs) {
    await prisma.auditLog.create({ data: { ...log, createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000) } })
  }

  // ── ModelProvider (AI 라우팅 카탈로그) ──
  const modelProviders = [
    {
      providerKey: 'anthropic',
      displayName: 'Anthropic Claude',
      hostType: 'CLOUD',
      costTier: 'HIGH',
      modelName: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    },
    {
      providerKey: 'openai',
      displayName: 'OpenAI GPT',
      hostType: 'CLOUD',
      costTier: 'HIGH',
    },
    {
      providerKey: 'gemini',
      displayName: 'Google Gemma',
      hostType: 'CLOUD',
      costTier: 'MID',
      notes: 'Bedrock에서는 Gemma. Vertex AI 전환 예정(GEMINI_BACKEND=vertex_gemini).',
    },
    {
      providerKey: 'onprem',
      displayName: 'Qwen 온프렘',
      hostType: 'ONPREM',
      costTier: 'LOW',
      notes: '판단/분류 전용. 실행 대상 아님.',
    },
  ]
  for (const mp of modelProviders) {
    await prisma.modelProvider.upsert({
      where: { providerKey: mp.providerKey },
      update: { displayName: mp.displayName, hostType: mp.hostType, costTier: mp.costTier, modelName: (mp as any).modelName ?? null, notes: (mp as any).notes ?? null },
      create: mp,
    })
  }

  console.log("시드 완료: 직원 10명, 과제 8건, 리터러시 6과정, 에이전트 7개, 산출물 11건, 지식추출 3건, 감사로그 13건, ModelProvider 4개")
}

main().catch(console.error).finally(() => prisma.$disconnect())
