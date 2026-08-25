import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * GET /api/dp/provisions/[id]/impact
 * 데이터 제공 회수 전 영향도 질의 — 연결 에이전트·프로젝트 사전 검사.
 *
 * 반환:
 *   provision    — 제공 기록 요약
 *   directImpact — 직접 연결 프로젝트→PRODUCTION 에이전트
 *   assetImpact  — 같은 DataAsset을 쓰는 다른 PROVISIONED DataRequest → 연결 에이전트
 *   totalAgents  — 영향받는 PRODUCTION 에이전트 수 (중복 제거)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireRole("DATA_PLATFORM", "AX_TEAM");
  if ("error" in auth) return auth.error;

  const provision = await prisma.dataProvision.findUnique({
    where: { id },
    select: {
      id: true,
      deliveryMode: true,
      providedAt: true,
      expiresAt: true,
      revokedAt: true,
      request: {
        select: {
          id: true,
          purpose: true,
          projectId: true,
          classification: true,
          assetId: true,
          asset: { select: { id: true, name: true, classification: true } },
          project: { select: { id: true, title: true, department: true } },
        },
      },
    },
  });

  if (!provision) {
    return NextResponse.json({ error: "제공 기록을 찾을 수 없습니다" }, { status: 404 });
  }
  if (provision.revokedAt) {
    return NextResponse.json({ error: "이미 회수된 제공 기록입니다" }, { status: 409 });
  }

  const affectedAgentIds = new Set<string>();

  // 1. 직접 영향: 이 DataRequest의 projectId → PRODUCTION 에이전트
  const directAgents: { id: string; agentName: string; prodStatus: string | null; projectId: string | null }[] = [];
  if (provision.request.projectId) {
    const agents = await prisma.agentRegistry.findMany({
      where: {
        projectId: provision.request.projectId,
        phase: "PRODUCTION",
      },
      select: { id: true, agentName: true, prodStatus: true, projectId: true },
    });
    for (const a of agents) {
      directAgents.push(a);
      affectedAgentIds.add(a.id);
    }
  }

  // 2. 자산 파생 영향: 같은 DataAsset → 다른 PROVISIONED 건들 → 연결 에이전트
  const assetImpact: {
    requestId: string;
    projectId: string | null;
    projectTitle: string | null;
    agents: { id: string; agentName: string; prodStatus: string | null }[];
  }[] = [];

  if (provision.request.assetId) {
    const siblingRequests = await prisma.dataRequest.findMany({
      where: {
        assetId: provision.request.assetId,
        status: "PROVISIONED",
        id: { not: provision.request.id }, // 현재 건 제외
      },
      select: {
        id: true,
        projectId: true,
        project: { select: { title: true } },
      },
    });

    for (const sibling of siblingRequests) {
      if (!sibling.projectId) continue;
      const agents = await prisma.agentRegistry.findMany({
        where: {
          projectId: sibling.projectId,
          phase: "PRODUCTION",
        },
        select: { id: true, agentName: true, prodStatus: true },
      });
      const uniqueAgents = agents.filter((a) => !affectedAgentIds.has(a.id));
      for (const a of uniqueAgents) affectedAgentIds.add(a.id);
      if (agents.length > 0) {
        assetImpact.push({
          requestId: sibling.id,
          projectId: sibling.projectId,
          projectTitle: sibling.project?.title ?? null,
          agents,
        });
      }
    }
  }

  return NextResponse.json({
    provision: {
      id: provision.id,
      deliveryMode: provision.deliveryMode,
      providedAt: provision.providedAt,
      expiresAt: provision.expiresAt,
    },
    request: provision.request,
    directImpact: {
      projectId: provision.request.projectId,
      projectTitle: provision.request.project?.title ?? null,
      agents: directAgents,
    },
    assetImpact,
    totalAgents: affectedAgentIds.size,
  });
}
