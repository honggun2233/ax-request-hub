-- CreateTable
CREATE TABLE "Agent" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retainUntil" DATETIME NOT NULL,
    "transferredTo" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AgentArtifact_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentKnowledgeExtract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "promptPatterns" TEXT,
    "failureCases" TEXT,
    "useCaseSummary" TEXT,
    "lessonsLearned" TEXT,
    "extractedBy" TEXT NOT NULL,
    "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentKnowledgeExtract_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
