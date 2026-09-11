-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user_request',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "description" TEXT NOT NULL,
    "asIs" TEXT NOT NULL,
    "expectedBenefit" TEXT NOT NULL,
    "confidentialityLevel" TEXT NOT NULL DEFAULT 'RESTRICTED',
    "championName" TEXT,
    "estimatedUsers" INTEGER NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "decisionNote" TEXT,
    "techHasApiSpec" BOOLEAN NOT NULL DEFAULT false,
    "techHasDataClassification" BOOLEAN NOT NULL DEFAULT false,
    "techHasAuditLogging" BOOLEAN NOT NULL DEFAULT false,
    "techHasTestCoverage" BOOLEAN NOT NULL DEFAULT false,
    "techHasDataQualityCheck" BOOLEAN NOT NULL DEFAULT false,
    "techHasHumanInLoop" BOOLEAN NOT NULL DEFAULT false,
    "techStandardsPassed" BOOLEAN NOT NULL DEFAULT false,
    "techStandardsFailedItems" TEXT NOT NULL DEFAULT '[]',
    "selectedCommonAgents" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isEssentialBusiness" BOOLEAN NOT NULL DEFAULT false,
    "noDataRequired" BOOLEAN NOT NULL DEFAULT false,
    "handoverRequestedAt" TIMESTAMP(3),
    "handoverNote" TEXT,
    "handoverArtifacts" TEXT,
    "intakeMethod" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "agentType" TEXT,
    "scope" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreCard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "impactScore" DOUBLE PRECISION NOT NULL,
    "roiScore" DOUBLE PRECISION NOT NULL,
    "confidentialityScore" DOUBLE PRECISION NOT NULL,
    "difficultyScore" DOUBLE PRECISION NOT NULL,
    "readinessScore" DOUBLE PRECISION NOT NULL,
    "strategyScore" DOUBLE PRECISION NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "evaluationRationale" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "employeeId" TEXT,
    "messages" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "currentLevel" TEXT NOT NULL DEFAULT 'L0',
    "levelGrantedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentQuota" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "toolType" TEXT NOT NULL,
    "totalQuota" INTEGER NOT NULL DEFAULT 0,
    "aiDensity" TEXT NOT NULL DEFAULT 'STANDARD',
    "managedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolAccount" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "quotaId" TEXT,
    "toolType" TEXT NOT NULL,
    "toolTier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestReason" TEXT NOT NULL DEFAULT '',
    "assignedByEmail" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelApplication" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedLevel" TEXT NOT NULL,
    "currentLevel" TEXT NOT NULL DEFAULT 'L0',
    "selfIntro" TEXT NOT NULL DEFAULT '',
    "trainingCompleted" TEXT NOT NULL DEFAULT '',
    "utilizationPlan" TEXT NOT NULL DEFAULT '',
    "recommendationNote" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fromLevel" TEXT NOT NULL,
    "toLevel" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionPolicy" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "serviceDescription" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAllocation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "accountInfo" TEXT NOT NULL DEFAULT '',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPolicy" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "level" TEXT,
    "employeeId" TEXT,
    "service" TEXT NOT NULL,
    "monthlyLimit" INTEGER NOT NULL,
    "singleCallLimit" INTEGER NOT NULL DEFAULT 0,
    "warningThreshold" INTEGER NOT NULL DEFAULT 80,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "tokenUsed" INTEGER NOT NULL DEFAULT 0,
    "costKrw" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inputById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecordDaily" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "tokenUsed" INTEGER NOT NULL DEFAULT 0,
    "costKrw" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageRecordDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageAlert" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graceStartedAt" TIMESTAMP(3),
    "callsSinceOverage" INTEGER NOT NULL DEFAULT 0,
    "ownerApprovalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "ownerRespondedAt" TIMESTAMP(3),
    "ownerRespondedBy" TEXT,

    CONSTRAINT "UsageAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deprecatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "deprecationReason" TEXT,
    "retirementNote" TEXT,
    "successorAgentId" TEXT,
    "dataRetentionYears" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kpiName" TEXT,
    "kpiTarget" DOUBLE PRECISION,
    "kpiType" TEXT,
    "kpiMeasureMethod" TEXT,
    "kpiMeasureCycle" TEXT DEFAULT 'MONTHLY',
    "lastUsedAt" TIMESTAMP(3),
    "kpiMissCount" INTEGER NOT NULL DEFAULT 0,
    "kpiLastScore" DOUBLE PRECISION,
    "performanceFlag" TEXT,
    "agentRegistryId" TEXT,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentKpiRecord" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "recordMonth" TEXT NOT NULL,
    "actualValue" DOUBLE PRECISION NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "achieveRate" DOUBLE PRECISION NOT NULL,
    "tokenCost" DOUBLE PRECISION,
    "performMatrix" TEXT,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentKpiRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentArtifact" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retainUntil" TIMESTAMP(3) NOT NULL,
    "transferredTo" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AgentArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentKnowledgeExtract" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "promptPatterns" TEXT,
    "failureCases" TEXT,
    "useCaseSummary" TEXT,
    "lessonsLearned" TEXT,
    "extractedBy" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentKnowledgeExtract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyCourse" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiteracyEnrollment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiteracyEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRegistry" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "purpose" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL,
    "owner" TEXT NOT NULL DEFAULT 'CTO',
    "status" TEXT NOT NULL DEFAULT 'active',
    "realDataConnected" BOOLEAN NOT NULL DEFAULT false,
    "fallbackRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "gate1Passed" BOOLEAN NOT NULL DEFAULT false,
    "gate2Passed" BOOLEAN NOT NULL DEFAULT false,
    "gate3Passed" BOOLEAN NOT NULL DEFAULT false,
    "lifecycleStage" TEXT NOT NULL DEFAULT 'GATE1',
    "gate1PassedAt" TIMESTAMP(3),
    "gate2PassedAt" TIMESTAMP(3),
    "gate3PassedAt" TIMESTAMP(3),
    "operatorTrustScore" INTEGER,
    "operatorComment" TEXT,
    "sam30dAccuracy" DOUBLE PRECISION,
    "degradedSince" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "retireReason" TEXT,
    "lastEvaluatedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "projectId" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'DEVELOPMENT',
    "devStage" TEXT,
    "prodStatus" TEXT,
    "trustScore" INTEGER,
    "pilotKpiTarget" TEXT,
    "prodKpiTarget" TEXT,
    "retireFlag" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "productionAt" TIMESTAMP(3),
    "recommendedProvider" TEXT,
    "providerOverride" TEXT,
    "riskType" INTEGER,
    "isHighImpact" BOOLEAN NOT NULL DEFAULT false,
    "transparencyMethod" TEXT,
    "transparencyAppliedAt" TIMESTAMP(3),
    "transparencyExceptionNote" TEXT,
    "sandboxRequestedAt" TIMESTAMP(3),
    "sandboxRequestReason" TEXT,
    "sandboxEnv" TEXT,
    "sandboxApprovedBy" TEXT,
    "sandboxApprovedAt" TIMESTAMP(3),
    "sandboxRejectReason" TEXT,
    "sandboxCompletedAt" TIMESTAMP(3),
    "pocResultSummary" TEXT,
    "isSystemAgent" BOOLEAN NOT NULL DEFAULT false,
    "commonAgentType" TEXT,

    CONSTRAINT "AgentRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AXProject" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AXProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProjectLink" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentProjectLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentScore" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "ticker" TEXT,
    "score" DOUBLE PRECISION,
    "rationale" TEXT,
    "dataType" TEXT NOT NULL DEFAULT 'mock',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phase" TEXT,
    "month" TEXT,
    "kpiActual" TEXT,
    "achieveRate" INTEGER,

    CONSTRAINT "AgentScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "category" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL DEFAULT '',
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "targetUsers" TEXT NOT NULL DEFAULT '[]',
    "securityLevel" TEXT NOT NULL DEFAULT 'PUBLIC',
    "purpose" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "promptText" TEXT NOT NULL DEFAULT '',
    "examples" TEXT NOT NULL DEFAULT '',
    "cautions" TEXT NOT NULL DEFAULT '',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillRating" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "employeeEmail" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouncilMeeting" (
    "id" TEXT NOT NULL,
    "meetingNo" INTEGER NOT NULL,
    "heldAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "CouncilMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouncilAgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT,
    "agentId" TEXT,
    "projectId" TEXT,
    "itemType" TEXT NOT NULL,
    "packageMeta" TEXT NOT NULL,
    "decision" TEXT,
    "decisionNote" TEXT,
    "conditions" TEXT,
    "decidedAt" TIMESTAMP(3),
    "dataRequestId" TEXT,

    CONSTRAINT "CouncilAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerDept" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "schemaMeta" TEXT,
    "deliveryModes" TEXT NOT NULL,
    "updateCycle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceSystem" TEXT NOT NULL DEFAULT 'INTERNAL',
    "externalId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "snowflakeDb" TEXT,
    "snowflakeSchema" TEXT,
    "dataOwnerId" TEXT,

    CONSTRAINT "DataAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "projectId" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trackType" TEXT NOT NULL DEFAULT 'A',
    "accessType" TEXT,
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "anonNote" TEXT,
    "includesPII" BOOLEAN NOT NULL DEFAULT false,
    "employeeId" TEXT,

    CONSTRAINT "DataRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataProvision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "deliveryMode" TEXT NOT NULL,
    "connectionRef" TEXT NOT NULL,
    "providedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "externalGranted" BOOLEAN NOT NULL DEFAULT false,
    "externalGrantedAt" TIMESTAMP(3),
    "externalGrantedBy" TEXT,

    CONSTRAINT "DataProvision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAppeal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceNote" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceDoc" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'L2',
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "author" TEXT NOT NULL DEFAULT '',
    "approvedBy" TEXT NOT NULL DEFAULT '',
    "approvedAt" TIMESTAMP(3),
    "securityLevel" TEXT NOT NULL DEFAULT 'RESTRICTED',
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT NOT NULL DEFAULT '',
    "relatedDocs" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDataLink" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "dataAssetId" TEXT NOT NULL,
    "purpose" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'READ',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentDataLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAgentLink" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeAgentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayCallLog" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "taskType" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costKrw" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "employeeId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyDecisionLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyDecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "agentKey" TEXT,
    "scopes" TEXT NOT NULL DEFAULT 'usage:write',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ServiceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRuntimeUsage" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "tokenUsed" INTEGER NOT NULL DEFAULT 0,
    "costKrw" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRuntimeUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelProvider" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "hostType" TEXT NOT NULL,
    "costTier" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "modelName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DataAssetDerivation" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoreCard_projectId_key" ON "ScoreCard"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_projectId_key" ON "ChatSession"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentQuota_department_toolType_key" ON "DepartmentQuota"("department", "toolType");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionPolicy_level_serviceName_key" ON "DistributionPolicy"("level", "serviceName");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_employeeId_service_yearMonth_key" ON "UsageRecord"("employeeId", "service", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecordDaily_employeeId_service_date_key" ON "UsageRecordDaily"("employeeId", "service", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_agentRegistryId_key" ON "Agent"("agentRegistryId");

-- CreateIndex
CREATE UNIQUE INDEX "LiteracyEnrollment_employeeId_courseId_key" ON "LiteracyEnrollment"("employeeId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRegistry_agentName_key" ON "AgentRegistry"("agentName");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRegistry_agentKey_key" ON "AgentRegistry"("agentKey");

-- CreateIndex
CREATE UNIQUE INDEX "AXProject_key_key" ON "AXProject"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProjectLink_agentId_projectId_key" ON "AgentProjectLink"("agentId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentScore_agentId_phase_month_key" ON "AgentScore"("agentId", "phase", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_skillId_key" ON "Skill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillRating_skillId_employeeEmail_key" ON "SkillRating"("skillId", "employeeEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CouncilMeeting_meetingNo_key" ON "CouncilMeeting"("meetingNo");

-- CreateIndex
CREATE UNIQUE INDEX "DataAsset_externalId_key" ON "DataAsset"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "DataProvision_requestId_key" ON "DataProvision"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceDoc_docId_key" ON "GovernanceDoc"("docId");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceDoc_fileName_key" ON "GovernanceDoc"("fileName");

-- CreateIndex
CREATE INDEX "Notification_recipientEmail_readAt_idx" ON "Notification"("recipientEmail", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDataLink_agentId_dataAssetId_key" ON "AgentDataLink"("agentId", "dataAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAgentLink_employeeId_agentId_key" ON "EmployeeAgentLink"("employeeId", "agentId");

-- CreateIndex
CREATE INDEX "GatewayCallLog_providerKey_createdAt_idx" ON "GatewayCallLog"("providerKey", "createdAt");

-- CreateIndex
CREATE INDEX "GatewayCallLog_taskType_providerKey_idx" ON "GatewayCallLog"("taskType", "providerKey");

-- CreateIndex
CREATE INDEX "PolicyDecisionLog_agentId_checkedAt_idx" ON "PolicyDecisionLog"("agentId", "checkedAt");

-- CreateIndex
CREATE INDEX "PolicyDecisionLog_employeeId_checkedAt_idx" ON "PolicyDecisionLog"("employeeId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceToken_tokenHash_key" ON "ServiceToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AgentRuntimeUsage_agentId_calledAt_idx" ON "AgentRuntimeUsage"("agentId", "calledAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelProvider_providerKey_key" ON "ModelProvider"("providerKey");

-- CreateIndex
CREATE UNIQUE INDEX "_DataAssetDerivation_AB_unique" ON "_DataAssetDerivation"("A", "B");

-- CreateIndex
CREATE INDEX "_DataAssetDerivation_B_index" ON "_DataAssetDerivation"("B");

-- AddForeignKey
ALTER TABLE "ScoreCard" ADD CONSTRAINT "ScoreCard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolAccount" ADD CONSTRAINT "ToolAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolAccount" ADD CONSTRAINT "ToolAccount_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "DepartmentQuota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelApplication" ADD CONSTRAINT "LevelApplication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelApplication" ADD CONSTRAINT "LevelApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelHistory" ADD CONSTRAINT "LevelHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelHistory" ADD CONSTRAINT "LevelHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAllocation" ADD CONSTRAINT "ServiceAllocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAllocation" ADD CONSTRAINT "ServiceAllocation_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "DistributionPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAllocation" ADD CONSTRAINT "ServiceAllocation_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_inputById_fkey" FOREIGN KEY ("inputById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecordDaily" ADD CONSTRAINT "UsageRecordDaily_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageAlert" ADD CONSTRAINT "UsageAlert_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_agentRegistryId_fkey" FOREIGN KEY ("agentRegistryId") REFERENCES "AgentRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKpiRecord" ADD CONSTRAINT "AgentKpiRecord_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKnowledgeExtract" ADD CONSTRAINT "AgentKnowledgeExtract_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyEnrollment" ADD CONSTRAINT "LiteracyEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "LiteracyCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiteracyEnrollment" ADD CONSTRAINT "LiteracyEnrollment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRegistry" ADD CONSTRAINT "AgentRegistry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProjectLink" ADD CONSTRAINT "AgentProjectLink_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProjectLink" ADD CONSTRAINT "AgentProjectLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AXProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentScore" ADD CONSTRAINT "AgentScore_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRating" ADD CONSTRAINT "SkillRating_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouncilAgendaItem" ADD CONSTRAINT "CouncilAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CouncilMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouncilAgendaItem" ADD CONSTRAINT "CouncilAgendaItem_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouncilAgendaItem" ADD CONSTRAINT "CouncilAgendaItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAsset" ADD CONSTRAINT "DataAsset_dataOwnerId_fkey" FOREIGN KEY ("dataOwnerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DataAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataProvision" ADD CONSTRAINT "DataProvision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DataRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAppeal" ADD CONSTRAINT "ProjectAppeal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDataLink" ADD CONSTRAINT "AgentDataLink_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDataLink" ADD CONSTRAINT "AgentDataLink_dataAssetId_fkey" FOREIGN KEY ("dataAssetId") REFERENCES "DataAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAgentLink" ADD CONSTRAINT "EmployeeAgentLink_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAgentLink" ADD CONSTRAINT "EmployeeAgentLink_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyDecisionLog" ADD CONSTRAINT "PolicyDecisionLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyDecisionLog" ADD CONSTRAINT "PolicyDecisionLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DataAssetDerivation" ADD CONSTRAINT "_DataAssetDerivation_A_fkey" FOREIGN KEY ("A") REFERENCES "DataAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DataAssetDerivation" ADD CONSTRAINT "_DataAssetDerivation_B_fkey" FOREIGN KEY ("B") REFERENCES "DataAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
