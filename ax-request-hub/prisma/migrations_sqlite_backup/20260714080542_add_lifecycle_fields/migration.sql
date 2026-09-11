-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AgentRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentName" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "purpose" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT 'CTO',
    "status" TEXT NOT NULL DEFAULT 'active',
    "realDataConnected" BOOLEAN NOT NULL DEFAULT false,
    "fallbackRate" REAL NOT NULL DEFAULT 1.0,
    "gate1Passed" BOOLEAN NOT NULL DEFAULT false,
    "gate2Passed" BOOLEAN NOT NULL DEFAULT false,
    "gate3Passed" BOOLEAN NOT NULL DEFAULT false,
    "lifecycleStage" TEXT NOT NULL DEFAULT 'GATE1',
    "gate1PassedAt" DATETIME,
    "gate2PassedAt" DATETIME,
    "gate3PassedAt" DATETIME,
    "operatorTrustScore" INTEGER,
    "operatorComment" TEXT,
    "sam30dAccuracy" REAL,
    "degradedSince" DATETIME,
    "retiredAt" DATETIME,
    "retireReason" TEXT,
    "lastEvaluatedAt" DATETIME,
    "nextReviewAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AgentRegistry" ("agentKey", "agentName", "createdAt", "dataSource", "fallbackRate", "gate1Passed", "gate2Passed", "gate3Passed", "id", "lastEvaluatedAt", "nextReviewAt", "notes", "owner", "purpose", "realDataConnected", "status", "updatedAt", "version") SELECT "agentKey", "agentName", "createdAt", "dataSource", "fallbackRate", "gate1Passed", "gate2Passed", "gate3Passed", "id", "lastEvaluatedAt", "nextReviewAt", "notes", "owner", "purpose", "realDataConnected", "status", "updatedAt", "version" FROM "AgentRegistry";
DROP TABLE "AgentRegistry";
ALTER TABLE "new_AgentRegistry" RENAME TO "AgentRegistry";
CREATE UNIQUE INDEX "AgentRegistry_agentName_key" ON "AgentRegistry"("agentName");
CREATE UNIQUE INDEX "AgentRegistry_agentKey_key" ON "AgentRegistry"("agentKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
