-- CreateTable
CREATE TABLE "AgentRegistry" (
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
    "lastEvaluatedAt" DATETIME,
    "nextReviewAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "rationale" TEXT,
    "dataType" TEXT NOT NULL DEFAULT 'mock',
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentScore_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentRegistry_agentName_key" ON "AgentRegistry"("agentName");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRegistry_agentKey_key" ON "AgentRegistry"("agentKey");
