-- v3 이중 라이프사이클 + 데이터 프로비저닝 스키마 마이그레이션
-- docs/prisma_v3_additions.prisma 병합 결과
-- SQLite enum 미지원 → String 필드로 대체, 허용값은 코드 레벨 제약
-- 실제 DB 변경은 `prisma db push`로 적용됨 (2026-07-23)

-- AgentRegistry 신규 필드
ALTER TABLE "AgentRegistry" ADD COLUMN "name" TEXT;
ALTER TABLE "AgentRegistry" ADD COLUMN "projectId" TEXT;
ALTER TABLE "AgentRegistry" ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'DEVELOPMENT';
ALTER TABLE "AgentRegistry" ADD COLUMN "devStage" TEXT;
ALTER TABLE "AgentRegistry" ADD COLUMN "prodStatus" TEXT;
ALTER TABLE "AgentRegistry" ADD COLUMN "trustScore" INTEGER;
ALTER TABLE "AgentRegistry" ADD COLUMN "pilotKpiTarget" TEXT;
ALTER TABLE "AgentRegistry" ADD COLUMN "prodKpiTarget" TEXT;
ALTER TABLE "AgentRegistry" ADD COLUMN "retireFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AgentRegistry" ADD COLUMN "lastUsedAt" DATETIME;
ALTER TABLE "AgentRegistry" ADD COLUMN "productionAt" DATETIME;

-- AgentScore 신규 필드 (v3 KPI 월별 실적)
ALTER TABLE "AgentScore" ADD COLUMN "phase" TEXT;
ALTER TABLE "AgentScore" ADD COLUMN "month" TEXT;
ALTER TABLE "AgentScore" ADD COLUMN "kpiActual" TEXT;
ALTER TABLE "AgentScore" ADD COLUMN "achieveRate" INTEGER;
-- AgentScore.ticker / score → nullable 처리 (기존 Gate 평가 점수 하위 호환)

-- 기존 AgentScore.ticker / score nullable 변환은 SQLite ALTER 한계로 db push 처리

-- CouncilMeeting
CREATE TABLE "CouncilMeeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingNo" INTEGER NOT NULL,
    "heldAt" DATETIME NOT NULL,
    "notes" TEXT
);
CREATE UNIQUE INDEX "CouncilMeeting_meetingNo_key" ON "CouncilMeeting"("meetingNo");

-- CouncilAgendaItem
CREATE TABLE "CouncilAgendaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "packageMeta" TEXT NOT NULL,
    "decision" TEXT,
    "decisionNote" TEXT,
    "conditions" TEXT,
    "decidedAt" DATETIME,
    CONSTRAINT "CouncilAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CouncilMeeting" ("id"),
    CONSTRAINT "CouncilAgendaItem_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistry" ("id")
);

-- DataAsset
CREATE TABLE "DataAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerDept" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "schemaMeta" TEXT,
    "deliveryModes" TEXT NOT NULL,
    "updateCycle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- DataRequest
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "projectId" TEXT NOT NULL,
    "agentId" TEXT,
    "assetId" TEXT,
    "requesterId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "requestedSpec" TEXT,
    "classification" TEXT NOT NULL,
    "periodMonths" INTEGER NOT NULL,
    "forProduction" BOOLEAN NOT NULL DEFAULT false,
    "rejectReason" TEXT,
    "reviewerId" TEXT,
    "prevRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DataRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id"),
    CONSTRAINT "DataRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DataAsset" ("id")
);

-- DataProvision
CREATE TABLE "DataProvision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "deliveryMode" TEXT NOT NULL,
    "connectionRef" TEXT NOT NULL,
    "providedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "revokeReason" TEXT,
    CONSTRAINT "DataProvision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DataRequest" ("id")
);
CREATE UNIQUE INDEX "DataProvision_requestId_key" ON "DataProvision"("requestId");

-- AgentScore 복합 유니크 인덱스
CREATE UNIQUE INDEX "AgentScore_agentId_phase_month_key" ON "AgentScore"("agentId", "phase", "month");
