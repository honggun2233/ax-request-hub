-- CreateTable
CREATE TABLE "AgentKpiRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "recordMonth" TEXT NOT NULL,
    "actualValue" REAL NOT NULL,
    "targetValue" REAL NOT NULL,
    "achieveRate" REAL NOT NULL,
    "tokenCost" REAL,
    "performMatrix" TEXT,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentKpiRecord_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deprecatedAt" DATETIME,
    "retiredAt" DATETIME,
    "deprecationReason" TEXT,
    "retirementNote" TEXT,
    "successorAgentId" TEXT,
    "dataRetentionYears" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "kpiName" TEXT,
    "kpiTarget" REAL,
    "kpiType" TEXT,
    "kpiMeasureMethod" TEXT,
    "kpiMeasureCycle" TEXT DEFAULT 'MONTHLY',
    "lastUsedAt" DATETIME,
    "kpiMissCount" INTEGER NOT NULL DEFAULT 0,
    "kpiLastScore" REAL,
    "performanceFlag" TEXT
);
INSERT INTO "new_Agent" ("createdAt", "dataRetentionYears", "department", "deprecatedAt", "deprecationReason", "description", "id", "name", "retiredAt", "retirementNote", "status", "successorAgentId", "updatedAt") SELECT "createdAt", "dataRetentionYears", "department", "deprecatedAt", "deprecationReason", "description", "id", "name", "retiredAt", "retirementNote", "status", "successorAgentId", "updatedAt" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
