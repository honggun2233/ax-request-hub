-- CreateTable
CREATE TABLE "AgentDataLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "dataAssetId" TEXT NOT NULL,
    "purpose" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'READ',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentDataLink_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AgentDataLink_dataAssetId_fkey" FOREIGN KEY ("dataAssetId") REFERENCES "DataAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployeeAgentLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "since" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeAgentLink_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EmployeeAgentLink_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentDataLink_agentId_dataAssetId_key" ON "AgentDataLink"("agentId", "dataAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAgentLink_employeeId_agentId_key" ON "EmployeeAgentLink"("employeeId", "agentId");
