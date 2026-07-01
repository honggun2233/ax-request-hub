-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user_request',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "description" TEXT NOT NULL,
    "asIs" TEXT NOT NULL,
    "expectedBenefit" TEXT NOT NULL,
    "confidentialityLevel" TEXT NOT NULL DEFAULT 'G2',
    "championName" TEXT,
    "estimatedUsers" INTEGER NOT NULL DEFAULT 0,
    "totalScore" REAL,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScoreCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "impactScore" REAL NOT NULL,
    "roiScore" REAL NOT NULL,
    "confidentialityScore" REAL NOT NULL,
    "difficultyScore" REAL NOT NULL,
    "readinessScore" REAL NOT NULL,
    "strategyScore" REAL NOT NULL,
    "totalScore" REAL NOT NULL,
    "evaluationRationale" TEXT NOT NULL,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "messages" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ChatSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoreCard_projectId_key" ON "ScoreCard"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_projectId_key" ON "ChatSession"("projectId");
