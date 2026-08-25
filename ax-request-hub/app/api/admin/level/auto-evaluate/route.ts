import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { notify } from "@/lib/notify";

// 자동 승인 가능한 최대 레벨 (L3+ 는 항상 수동 심사)
const AUTO_APPROVE_MAX_LEVEL = "L2";

/**
 * POST /api/admin/level/auto-evaluate
 * PENDING 상태 레벨 신청을 리터러시 과정 이수 현황 기반으로 자동 평가.
 *
 * 자동 승인 조건 (v3 §리터러시 레벨 기준):
 *   - 신청 레벨 ≤ L2
 *   - isRequired=true 과정 전건 이수(status=COMPLETED)
 *   → APPROVED 처리 + 레벨 승급 + LevelHistory 기록 + 알림
 *
 * 자동 에스컬레이션 조건 (수동 심사로 이관):
 *   - 신청 레벨 ≥ L3
 *   - 또는 필수 과정 미이수 존재
 *   → REVIEWING 전환 (reviewNote에 미이수 과정 명시)
 *
 * GET /api/admin/level/auto-evaluate
 *   실제 처리 없이 미리보기만 반환.
 */
export async function POST() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  // 1. 필수 리터러시 과정 전체 조회
  const requiredCourses = await prisma.literacyCourse.findMany({
    where: { isRequired: true, isActive: true },
    select: { id: true, title: true, level: true },
  });

  // 2. PENDING 신청 전체 조회
  const pendingApps = await prisma.levelApplication.findMany({
    where: { status: "PENDING" },
    include: { employee: { select: { id: true, email: true, name: true, currentLevel: true } } },
  });

  const autoApproved: string[] = [];
  const escalated: string[] = [];
  const nowDate = new Date();

  for (const app of pendingApps) {
    const levelNum = parseInt(app.requestedLevel.replace("L", ""), 10);
    const maxLevelNum = parseInt(AUTO_APPROVE_MAX_LEVEL.replace("L", ""), 10);

    // L3+ → 항상 수동 심사 에스컬레이션
    if (levelNum > maxLevelNum) {
      await prisma.levelApplication.update({
        where: { id: app.id },
        data: {
          status: "REVIEWING",
          reviewNote: `${app.requestedLevel} 이상은 수동 심사 대상입니다. AX팀 개별 심사가 필요합니다.`,
          reviewedById: (auth as any).user?.id ?? null,
          reviewedAt: nowDate,
        },
      });
      escalated.push(app.id);
      continue;
    }

    // 해당 직원의 이수 완료 과정 조회
    const completions = await prisma.literacyEnrollment.findMany({
      where: {
        employeeId: app.employee.id,
        courseId: { in: requiredCourses.map((c) => c.id) },
        status: "COMPLETED",
      },
      select: { courseId: true },
    });
    const completedIds = new Set(completions.map((e) => e.courseId));
    const missingCourses = requiredCourses.filter((c) => !completedIds.has(c.id));

    if (missingCourses.length > 0) {
      // 필수 과정 미이수 → 에스컬레이션
      const missingTitles = missingCourses.map((c) => c.title).join(", ");
      await prisma.levelApplication.update({
        where: { id: app.id },
        data: {
          status: "REVIEWING",
          reviewNote: `미이수 필수 과정이 있어 수동 심사로 이관합니다. 미이수: ${missingTitles}`,
          reviewedById: (auth as any).user?.id ?? null,
          reviewedAt: nowDate,
        },
      });
      escalated.push(app.id);
      continue;
    }

    // 자동 승인 처리
    const fromLevel = app.employee.currentLevel;
    const toLevel = app.requestedLevel;

    await prisma.$transaction([
      prisma.levelApplication.update({
        where: { id: app.id },
        data: {
          status: "APPROVED",
          reviewNote: "리터러시 필수 과정 전건 이수 확인 — 자동 승인",
          reviewedById: (auth as any).user?.id ?? null,
          reviewedAt: nowDate,
        },
      }),
      prisma.employee.update({
        where: { id: app.employee.id },
        data: { currentLevel: toLevel, levelGrantedAt: nowDate },
      }),
      prisma.levelHistory.create({
        data: {
          employeeId: app.employee.id,
          fromLevel,
          toLevel,
          reason: "리터러시 필수 과정 전건 이수 — 자동 승인",
          changedById: (auth as any).user?.id ?? app.employee.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "Employee",
          entityId: app.employee.id,
          action: "LEVEL_AUTO_APPROVED",
          actorEmail: auth.user.email,
          detail: JSON.stringify({ applicationId: app.id, fromLevel, toLevel }),
        },
      }),
    ]);

    await notify(
      app.employee.email,
      `${toLevel} 자동 승급 완료`,
      `리터러시 필수 과정 전건 이수가 확인되어 ${toLevel}로 자동 승급되었습니다.`,
      "/me/level"
    );

    autoApproved.push(app.id);
  }

  return NextResponse.json({
    ok: true,
    total: pendingApps.length,
    autoApproved: autoApproved.length,
    escalated: escalated.length,
    autoApprovedIds: autoApproved,
    escalatedIds: escalated,
  });
}

/**
 * GET /api/admin/level/auto-evaluate
 * 실제 처리 없이 자동 평가 결과 미리보기.
 */
export async function GET() {
  const auth = await requireRole("AX_TEAM");
  if ("error" in auth) return auth.error;

  const requiredCourses = await prisma.literacyCourse.findMany({
    where: { isRequired: true, isActive: true },
    select: { id: true, title: true },
  });

  const pendingApps = await prisma.levelApplication.findMany({
    where: { status: "PENDING" },
    include: { employee: { select: { id: true, email: true, name: true, currentLevel: true } } },
  });

  const maxLevelNum = parseInt(AUTO_APPROVE_MAX_LEVEL.replace("L", ""), 10);

  const preview = await Promise.all(
    pendingApps.map(async (app) => {
      const levelNum = parseInt(app.requestedLevel.replace("L", ""), 10);
      if (levelNum > maxLevelNum) {
        return { id: app.id, employee: app.employee.name, requestedLevel: app.requestedLevel, result: "ESCALATE", reason: "L3+ 수동 심사" };
      }
      const completions = await prisma.literacyEnrollment.findMany({
        where: { employeeId: app.employee.id, courseId: { in: requiredCourses.map((c) => c.id) }, status: "COMPLETED" },
        select: { courseId: true },
      });
      const completedIds = new Set(completions.map((e) => e.courseId));
      const missing = requiredCourses.filter((c) => !completedIds.has(c.id));
      return {
        id: app.id, employee: app.employee.name, requestedLevel: app.requestedLevel,
        result: missing.length === 0 ? "APPROVE" : "ESCALATE",
        missingCourses: missing.map((c) => c.title),
      };
    })
  );

  return NextResponse.json({ pendingCount: pendingApps.length, requiredCourseCount: requiredCourses.length, preview });
}
