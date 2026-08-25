import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";

/**
 * GET /api/dp/catalog
 * 데이터 자산 카탈로그 목록 조회 — 전체 인증 사용자 조회 가능.
 * ?q=검색어&classification=G1|G2|G3&ownerDept=팀명&activeOnly=true
 *
 * POST /api/dp/catalog
 * 새 데이터 자산 등록 — DATA_PLATFORM 전용.
 *
 * PATCH /api/dp/catalog
 * 데이터 자산 정보 수정 — DATA_PLATFORM 전용. body: { id, ...fields }
 */

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const classification = searchParams.get("classification");
  const ownerDept = searchParams.get("ownerDept")?.trim();
  const activeOnly = searchParams.get("activeOnly") !== "false"; // 기본값: 활성만

  const assets = await prisma.dataAsset.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(classification ? { classification } : {}),
      ...(ownerDept ? { ownerDept: { contains: ownerDept } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
              { ownerDept: { contains: q } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      ownerDept: true,
      classification: true,
      deliveryModes: true,
      updateCycle: true,
      isActive: true,
      schemaMeta: true,
      sourceSystem: true,
      externalId: true,
      syncedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { requests: true } },
    },
    orderBy: [{ classification: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(assets);
}

export async function POST(req: Request) {
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const {
    name,
    description,
    ownerDept,
    classification,
    schemaMeta,
    deliveryModes,
    updateCycle,
    sourceSystem,
    externalId,
    snowflakeDb,
    snowflakeSchema,
  } = body;

  if (!name?.trim() || !description?.trim() || !ownerDept?.trim() || !classification || !deliveryModes) {
    return NextResponse.json(
      { error: "name, description, ownerDept, classification, deliveryModes는 필수입니다" },
      { status: 400 }
    );
  }

  const VALID_CLASSIFICATIONS = ["G1", "G2", "G3"];
  if (!VALID_CLASSIFICATIONS.includes(classification)) {
    return NextResponse.json(
      { error: `classification은 ${VALID_CLASSIFICATIONS.join(" | ")} 중 하나여야 합니다` },
      { status: 400 }
    );
  }

  // deliveryModes: comma-separated 문자열 또는 배열 둘 다 허용
  const modesStr = Array.isArray(deliveryModes) ? deliveryModes.join(",") : deliveryModes;
  const VALID_MODES = ["API", "FILE", "DB"];
  const modes = modesStr.split(",").map((m: string) => m.trim());
  const invalid = modes.filter((m: string) => !VALID_MODES.includes(m));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `지원하지 않는 deliveryMode: ${invalid.join(", ")}. 허용값: ${VALID_MODES.join(" | ")}` },
      { status: 400 }
    );
  }

  // externalId 중복 체크
  if (externalId?.trim()) {
    const dup = await prisma.dataAsset.findUnique({ where: { externalId: externalId.trim() } });
    if (dup) {
      return NextResponse.json({ error: `externalId '${externalId}'가 이미 존재합니다` }, { status: 409 });
    }
  }

  const asset = await prisma.dataAsset.create({
    data: {
      name: name.trim(),
      description: description.trim(),
      ownerDept: ownerDept.trim(),
      classification,
      deliveryModes: modesStr,
      ...(schemaMeta ? { schemaMeta } : {}),
      ...(updateCycle ? { updateCycle } : {}),
      ...(sourceSystem ? { sourceSystem } : {}),
      ...(externalId?.trim() ? { externalId: externalId.trim() } : {}),
      ...(snowflakeDb ? { snowflakeDb } : {}),
      ...(snowflakeSchema ? { snowflakeSchema } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "DataAsset",
      entityId: asset.id,
      action: "DATA_ASSET_CREATED",
      actorEmail: (auth as any).user.email,
      detail: JSON.stringify({ name: asset.name, classification }),
    },
  });

  return NextResponse.json(asset, { status: 201 });
}

export async function PATCH(req: Request) {
  const auth = await requireRole("DATA_PLATFORM");
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { id, ...fields } = body;

  if (!id?.trim()) {
    return NextResponse.json({ error: "수정할 데이터 자산 id가 필요합니다" }, { status: 400 });
  }

  const existing = await prisma.dataAsset.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "데이터 자산을 찾을 수 없습니다" }, { status: 404 });

  // 허용 필드만 추출 (externalId unique 변경 시 중복 체크)
  const allowed = [
    "name",
    "description",
    "ownerDept",
    "classification",
    "schemaMeta",
    "deliveryModes",
    "updateCycle",
    "isActive",
    "sourceSystem",
    "externalId",
    "snowflakeDb",
    "snowflakeSchema",
  ];
  const updateData: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in fields) updateData[key] = fields[key];
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "수정할 필드가 없습니다" }, { status: 400 });
  }

  // classification 유효성
  if (updateData.classification) {
    if (!["G1", "G2", "G3"].includes(updateData.classification as string)) {
      return NextResponse.json({ error: "classification은 G1 | G2 | G3 중 하나여야 합니다" }, { status: 400 });
    }
  }

  // externalId 중복 체크 (다른 자산과 충돌 방지)
  if (updateData.externalId && updateData.externalId !== existing.externalId) {
    const dup = await prisma.dataAsset.findUnique({ where: { externalId: updateData.externalId as string } });
    if (dup) {
      return NextResponse.json({ error: `externalId '${updateData.externalId}'가 이미 존재합니다` }, { status: 409 });
    }
  }

  const updated = await prisma.dataAsset.update({ where: { id }, data: updateData });

  await prisma.auditLog.create({
    data: {
      entityType: "DataAsset",
      entityId: id,
      action: "DATA_ASSET_UPDATED",
      actorEmail: (auth as any).user.email,
      detail: JSON.stringify(updateData),
    },
  });

  return NextResponse.json(updated);
}
