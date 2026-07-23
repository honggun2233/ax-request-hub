/**
 * AX Hub v3 데이터 이관 스크립트
 * ------------------------------------------------------------
 * 대상:
 *   1) 기존 AgentRegistry 행 → phase=DEVELOPMENT + devStage 매핑
 *   2) 기존 Agent(폐기 관리 모델) 행 → AgentRegistry(phase=PRODUCTION/CLOSED)로 통합
 *   3) 기존 AgentKpiRecord → AgentScore(phase=PRODUCTION)
 *   4) 상용 상태로 이관되는 에이전트에 대해 "제0차 소급 승인" 협의회 레코드 생성
 *      (무결성 제약: phase=PRODUCTION ⇒ APPROVED 의결 존재)
 *
 * 실행 전제:
 *   - prisma_v3_additions.prisma 병합 + `prisma migrate dev` 완료
 *   - 이 시점에는 Agent/AgentKpiRecord 모델이 아직 schema에 남아 있어야 함
 *   - DB 백업 완료 (README 참조)
 *
 * 실행:
 *   npx tsx scripts/migrate-agents-v3.ts          # 실제 반영
 *   DRY_RUN=1 npx tsx scripts/migrate-agents-v3.ts # 검증만 (쓰기 없음)
 *
 * ⚠️ FIELD_MAP: 실제 스키마의 필드명이 다르면 여기만 수정하면 된다.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1";

// ── 실제 스키마 필드명에 맞게 조정 ─────────────────────────────
const FIELD_MAP = {
  // 기존 AgentRegistry에서 Gate 진행도를 담던 필드명
  registryStageField: "gateStage", // 예: "GATE1" | "GATE2" | "GATE3" 값 보유 가정
  // 기존 Agent(폐기 관리)에서 라이프사이클 상태를 담던 필드명
  legacyStatusField: "status", // 예: "ACTIVE" | "SUSPENDED" | "DEPRECATED" | "RETIRED"
  // 기존 Agent에서 KPI 목표를 담던 필드명 (없으면 null 유지)
  legacyKpiTargetField: "kpiTarget",
} as const;

// 기존 Gate 진행도 → devStage 매핑
const DEV_STAGE_MAP: Record<string, string> = {
  GATE1_WAIT: "GATE1",
  GATE1: "GATE1",
  GATE2: "GATE2",
  GATE2_PASSED: "GATE2",
  GATE3: "GATE3",
  GATE3_PASSED: "GATE3",
};

// 기존 Agent 상태 → phase/prodStatus 매핑
const PROD_MAP: Record<string, { phase: string; prodStatus: string }> = {
  ACTIVE: { phase: "PRODUCTION", prodStatus: "ACTIVE" },
  SUSPENDED: { phase: "PRODUCTION", prodStatus: "SUSPENDED" },
  DEPRECATED: { phase: "PRODUCTION", prodStatus: "DEPRECATED" },
  RETIRED: { phase: "CLOSED", prodStatus: "RETIRED" },
};

async function main() {
  console.log(`\n=== AX Hub v3 이관 시작 ${DRY_RUN ? "(DRY RUN — 쓰기 없음)" : ""} ===\n`);
  const report = { devMapped: 0, prodMigrated: 0, scoresMigrated: 0, retroApprovals: 0, skipped: [] as string[] };

  // ── 0. 소급 승인용 제0차 협의회 (상용 이관 건이 있을 때만 생성) ──
  let retroMeetingId: string | null = null;
  const ensureRetroMeeting = async () => {
    if (retroMeetingId) return retroMeetingId;
    if (DRY_RUN) return (retroMeetingId = "dry-run-meeting");
    const m = await prisma.councilMeeting.upsert({
      where: { meetingNo: 0 },
      update: {},
      create: {
        meetingNo: 0,
        heldAt: new Date(),
        notes:
          "v3 마이그레이션 소급 승인 배치 — 협의회 체계 도입 이전에 운영 중이던 상용 에이전트의 " +
          "기승인 사실을 시스템상 소급 기록. 차기 정기 협의회에서 일괄 추인 안건으로 보고할 것.",
      },
    });
    return (retroMeetingId = m.id);
  };

  // ── 1. 기존 AgentRegistry → devStage 매핑 ──────────────────
  const registries: any[] = await prisma.agentRegistry.findMany();
  for (const r of registries) {
    if (r.phase && r.devStage) continue; // 이미 이관됨 (재실행 안전)
    const rawStage = r[FIELD_MAP.registryStageField];
    const devStage = DEV_STAGE_MAP[rawStage] ?? "GATE1";
    if (!DEV_STAGE_MAP[rawStage]) {
      report.skipped.push(`AgentRegistry ${r.id}: 미인식 stage '${rawStage}' → GATE1 기본값 적용`);
    }
    if (!DRY_RUN) {
      await prisma.agentRegistry.update({
        where: { id: r.id },
        data: { phase: "DEVELOPMENT", devStage },
      });
    }
    report.devMapped++;
  }

  // ── 2. 기존 Agent(폐기 관리) → AgentRegistry 통합 ──────────
  // 이름 기준으로 기존 레지스트리와 매칭, 없으면 신규 생성
  const legacyAgents: any[] = await (prisma as any).agent.findMany({
    include: { kpiRecords: true }, // 관계명이 다르면 조정
  });

  for (const la of legacyAgents) {
    const rawStatus = la[FIELD_MAP.legacyStatusField];
    const mapped = PROD_MAP[rawStatus];
    if (!mapped) {
      report.skipped.push(`Agent ${la.id} (${la.name}): 미인식 status '${rawStatus}' — 수동 확인 필요`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      // 2-1. 대상 레지스트리 확보 (이름 매칭 → 없으면 생성)
      let reg = await tx.agentRegistry.findFirst({ where: { name: la.name } });
      const data = {
        phase: mapped.phase as any,
        devStage: null,
        prodStatus: mapped.prodStatus as any,
        prodKpiTarget: la[FIELD_MAP.legacyKpiTargetField] ?? null,
        retireFlag: la.retireFlag ?? false,
        lastUsedAt: la.lastUsedAt ?? null,
        productionAt: la.createdAt ?? new Date(),
        retiredAt: rawStatus === "RETIRED" ? (la.updatedAt ?? new Date()) : null,
      };
      if (DRY_RUN) {
        report.prodMigrated++;
      } else if (reg) {
        reg = await tx.agentRegistry.update({ where: { id: reg.id }, data });
        report.prodMigrated++;
      } else {
        reg = await tx.agentRegistry.create({
          data: { name: la.name, projectId: la.projectId ?? "LEGACY", ...data },
        });
        report.prodMigrated++;
      }

      // 2-2. 소급 승인 레코드 (무결성 제약 충족)
      const meetingId = await ensureRetroMeeting();
      if (!DRY_RUN && reg) {
        const exists = await tx.councilAgendaItem.findFirst({
          where: { agentId: reg.id, itemType: "PROD_APPROVAL", decision: "APPROVED" },
        });
        if (!exists) {
          await tx.councilAgendaItem.create({
            data: {
              meetingId,
              agentId: reg.id,
              itemType: "PROD_APPROVAL",
              packageMeta: JSON.stringify({ retroactive: true, legacyAgentId: la.id, legacyStatus: rawStatus }),
              decision: "APPROVED",
              decisionNote: "v3 마이그레이션 소급 승인 (기운영 상용 에이전트)",
              decidedAt: new Date(),
            },
          });
          report.retroApprovals++;
        }
      } else {
        report.retroApprovals++;
      }

      // 2-3. AgentKpiRecord → AgentScore (phase=PRODUCTION)
      for (const k of la.kpiRecords ?? []) {
        if (DRY_RUN) {
          report.scoresMigrated++;
          continue;
        }
        if (!reg) continue;
        await tx.agentScore.upsert({
          where: {
            agentId_phase_month: { agentId: reg.id, phase: "PRODUCTION", month: k.month },
          },
          update: {},
          create: {
            agentId: reg.id,
            phase: "PRODUCTION",
            month: k.month,
            kpiActual: typeof k.kpiActual === "string" ? k.kpiActual : JSON.stringify(k.kpiActual ?? {}),
            achieveRate: k.achieveRate ?? 0,
          },
        });
        report.scoresMigrated++;
      }
    });
  }

  // ── 3. 결과 보고 ──────────────────────────────────────────
  console.log("── 이관 결과 ──────────────────────────────");
  console.log(`개발 레지스트리 devStage 매핑 : ${report.devMapped}건`);
  console.log(`상용 에이전트 통합 이관       : ${report.prodMigrated}건`);
  console.log(`소급 승인(제0차) 레코드       : ${report.retroApprovals}건`);
  console.log(`KPI 실적 → AgentScore 이관    : ${report.scoresMigrated}건`);
  if (report.skipped.length) {
    console.log(`\n⚠️ 수동 확인 필요 (${report.skipped.length}건):`);
    report.skipped.forEach((s) => console.log("  - " + s));
  }

  // ── 4. 이관 후 무결성 검증 ─────────────────────────────────
  if (!DRY_RUN) {
    const badDev = await prisma.agentRegistry.count({
      where: { phase: "DEVELOPMENT", prodStatus: { not: null } },
    });
    const badProd = await prisma.agentRegistry.count({
      where: { phase: "PRODUCTION", devStage: { not: null } },
    });
    const prodNoApproval = await prisma.agentRegistry.count({
      where: {
        phase: "PRODUCTION",
        councilItems: { none: { itemType: "PROD_APPROVAL", decision: "APPROVED" } },
      },
    });
    console.log("\n── 무결성 검증 ────────────────────────────");
    console.log(`DEVELOPMENT인데 prodStatus 보유 : ${badDev}건 (0이어야 정상)`);
    console.log(`PRODUCTION인데 devStage 보유    : ${badProd}건 (0이어야 정상)`);
    console.log(`PRODUCTION인데 승인 의결 없음   : ${prodNoApproval}건 (0이어야 정상)`);
    if (badDev + badProd + prodNoApproval > 0) {
      console.error("\n❌ 무결성 위반 존재 — 4단계(레거시 모델 삭제) 진행 금지. 위 건 수동 정정 후 재검증.");
      process.exitCode = 1;
      return;
    }
  }

  console.log("\n✅ 완료. 검증 통과 시 schema에서 Agent/AgentKpiRecord 삭제 후 마이그레이션 B 실행 (README 4단계).");
}

main()
  .catch((e) => {
    console.error("❌ 이관 실패 — DB는 트랜잭션 단위로만 반영됨. 백업 확인 후 원인 수정:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
