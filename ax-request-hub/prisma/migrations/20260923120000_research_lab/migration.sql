-- ResearchLab: AI 연구망 접근 관리·리소스 할당·실험 추적
-- 2026-09-23

-- ───────────────────────────────────────────
-- 1. TokenPolicy.networkContext 추가 + 백필
--    기존 레코드 전부 PRODUCTION으로 백필
--    ⚠ quota.ts 두 곳에 networkContext='PRODUCTION' 필터 이미 반영됨
-- ───────────────────────────────────────────
ALTER TABLE "TokenPolicy"
    ADD COLUMN "networkContext" TEXT NOT NULL DEFAULT 'PRODUCTION'
        CONSTRAINT "TokenPolicy_networkContext_check"
        CHECK ("networkContext" IN ('PRODUCTION', 'RESEARCH'));

-- 기존 레코드 명시적 백필 (DEFAULT가 이미 처리하지만 명시적으로)
UPDATE "TokenPolicy" SET "networkContext" = 'PRODUCTION';

CREATE INDEX IF NOT EXISTS "TokenPolicy_networkContext_service_isActive_idx"
    ON "TokenPolicy" ("networkContext", "service", "isActive");

-- ───────────────────────────────────────────
-- 2. AgentRegistry.labExperimentId 추가
--    nullable unique — 졸업 훅 (LabExperiment → AgentRegistry)
-- ───────────────────────────────────────────
ALTER TABLE "AgentRegistry"
    ADD COLUMN "labExperimentId" TEXT UNIQUE;

-- ───────────────────────────────────────────
-- 3. ResearchLab 신규 테이블
-- ───────────────────────────────────────────

-- 연구망 접근 신청·승인·회수
-- status: PENDING | APPROVED | ACTIVE | REVOKED | EXPIRED
CREATE TABLE "LabAccess" (
    "id"          TEXT        NOT NULL,
    "employeeId"  TEXT        NOT NULL,
    "purpose"     TEXT        NOT NULL,
    "status"      TEXT        NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "approvedAt"  TIMESTAMPTZ,
    "approvedBy"  TEXT,
    "revokedAt"   TIMESTAMPTZ,
    "expiresAt"   TIMESTAMPTZ,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "LabAccess_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LabAccess_employeeId_fkey"
        FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id")
);

CREATE INDEX "LabAccess_employeeId_status_idx" ON "LabAccess" ("employeeId", "status");
CREATE INDEX "LabAccess_status_expiresAt_idx"  ON "LabAccess" ("status", "expiresAt");

-- 리소스 카탈로그 (물리 장비·컨테이너 슬롯 전용)
-- type: MACHINE_SLOT | CONTAINER_SLOT
CREATE TABLE "LabResource" (
    "id"            TEXT        NOT NULL,
    "name"          TEXT        NOT NULL,
    "type"          TEXT        NOT NULL,
    "description"   TEXT,
    "totalCapacity" INTEGER     NOT NULL,
    "location"      TEXT,
    "isActive"      BOOLEAN     NOT NULL DEFAULT TRUE,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "LabResource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LabResource_type_isActive_idx" ON "LabResource" ("type", "isActive");

-- 쿼터 정책 템플릿
-- targetType: ROLE | DEPARTMENT | EMPLOYEE
-- targetId: null = 전체 기본값
-- 리졸빙 순위: EMPLOYEE > DEPARTMENT > ROLE > (targetId=null)
CREATE TABLE "LabQuotaPolicy" (
    "id"                   TEXT        NOT NULL,
    "name"                 TEXT        NOT NULL,
    "targetType"           TEXT        NOT NULL,
    "targetId"             TEXT,
    "machineHoursPerMonth" INTEGER     NOT NULL DEFAULT 20,
    "containerSlotsMax"    INTEGER     NOT NULL DEFAULT 2,
    "priority"             INTEGER     NOT NULL DEFAULT 100,
    "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "LabQuotaPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LabQuotaPolicy_targetType_targetId_idx"
    ON "LabQuotaPolicy" ("targetType", "targetId");

-- 실제 할당: LabAccess × LabResource × LabQuotaPolicy
-- customOverride: 예외 처리용 JSON (빈번해지면 새 Policy 추가 신호)
CREATE TABLE "LabAllocation" (
    "id"             TEXT        NOT NULL,
    "labAccessId"    TEXT        NOT NULL,
    "resourceId"     TEXT        NOT NULL,
    "quotaPolicyId"  TEXT        NOT NULL,
    "customOverride" JSONB,
    "allocatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "revokedAt"      TIMESTAMPTZ,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "LabAllocation_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "LabAllocation_labAccessId_fkey"
        FOREIGN KEY ("labAccessId")  REFERENCES "LabAccess"      ("id"),
    CONSTRAINT "LabAllocation_resourceId_fkey"
        FOREIGN KEY ("resourceId")   REFERENCES "LabResource"    ("id"),
    CONSTRAINT "LabAllocation_quotaPolicyId_fkey"
        FOREIGN KEY ("quotaPolicyId") REFERENCES "LabQuotaPolicy" ("id")
);

CREATE INDEX "LabAllocation_labAccessId_idx"          ON "LabAllocation" ("labAccessId");
CREATE INDEX "LabAllocation_resourceId_revokedAt_idx" ON "LabAllocation" ("resourceId", "revokedAt");

-- 실험 추적
-- status: DRAFT | RUNNING | COMPLETED | ARCHIVED | GRADUATED
CREATE TABLE "LabExperiment" (
    "id"          TEXT        NOT NULL,
    "labAccessId" TEXT        NOT NULL,
    "title"       TEXT        NOT NULL,
    "description" TEXT,
    "status"      TEXT        NOT NULL DEFAULT 'DRAFT',
    "startedAt"   TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "notes"       TEXT,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "LabExperiment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LabExperiment_labAccessId_fkey"
        FOREIGN KEY ("labAccessId") REFERENCES "LabAccess" ("id")
);

CREATE INDEX "LabExperiment_labAccessId_status_idx"
    ON "LabExperiment" ("labAccessId", "status");

-- ───────────────────────────────────────────
-- 4. AgentRegistry → LabExperiment FK 추가
--    (LabExperiment 테이블 생성 후)
-- ───────────────────────────────────────────
ALTER TABLE "AgentRegistry"
    ADD CONSTRAINT "AgentRegistry_labExperimentId_fkey"
    FOREIGN KEY ("labExperimentId") REFERENCES "LabExperiment" ("id");
