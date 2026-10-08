-- GatewayCallLog 월별 파티셔닝 마이그레이션
-- 목적: 전사 확산 시 누적 로그 집계 쿼리 성능 보장
-- 방식: PostgreSQL RANGE 파티셔닝 (createdAt 기준 월별)
-- PK 변경: (id) → (id, createdAt) — 파티션 키 포함 요건
-- 앱 코드 영향: create()만 사용, findUnique() 없음 — 변경 없음

BEGIN;

-- 1. 기존 테이블 보존 (데이터 이전용)
ALTER TABLE "GatewayCallLog" RENAME TO "GatewayCallLog_old";
-- PK 제약 이름 변경 (새 테이블에서 동일 이름 재사용하기 위해)
ALTER TABLE "GatewayCallLog_old" RENAME CONSTRAINT "GatewayCallLog_pkey" TO "GatewayCallLog_old_pkey";

-- 2. 파티션 부모 테이블 생성
CREATE TABLE "GatewayCallLog" (
    "id"           TEXT             NOT NULL DEFAULT '',
    "providerKey"  TEXT             NOT NULL,
    "taskType"     TEXT,
    "inputTokens"  INTEGER          NOT NULL DEFAULT 0,
    "outputTokens" INTEGER          NOT NULL DEFAULT 0,
    "totalTokens"  INTEGER          NOT NULL DEFAULT 0,
    "costKrw"      DECIMAL(65,30)   NOT NULL DEFAULT 0,
    "employeeId"   TEXT,
    "projectId"    TEXT,
    "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GatewayCallLog_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- 3. 월별 파티션 생성 (2026-09 ~ 2027-12)
CREATE TABLE "GatewayCallLog_2026_09" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE "GatewayCallLog_2026_10" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE "GatewayCallLog_2026_11" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE "GatewayCallLog_2026_12" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE "GatewayCallLog_2027_01" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

CREATE TABLE "GatewayCallLog_2027_02" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

CREATE TABLE "GatewayCallLog_2027_03" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

CREATE TABLE "GatewayCallLog_2027_04" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');

CREATE TABLE "GatewayCallLog_2027_05" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

CREATE TABLE "GatewayCallLog_2027_06" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

CREATE TABLE "GatewayCallLog_2027_07" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-07-01') TO ('2027-08-01');

CREATE TABLE "GatewayCallLog_2027_08" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-08-01') TO ('2027-09-01');

CREATE TABLE "GatewayCallLog_2027_09" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-09-01') TO ('2027-10-01');

CREATE TABLE "GatewayCallLog_2027_10" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-10-01') TO ('2027-11-01');

CREATE TABLE "GatewayCallLog_2027_11" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-11-01') TO ('2027-12-01');

CREATE TABLE "GatewayCallLog_2027_12" PARTITION OF "GatewayCallLog"
    FOR VALUES FROM ('2027-12-01') TO ('2028-01-01');

-- 미래 범위 안전망 (파티션 누락 시 insert 실패 방지)
CREATE TABLE "GatewayCallLog_future" PARTITION OF "GatewayCallLog" DEFAULT;

-- 4. 기존 데이터 이전
INSERT INTO "GatewayCallLog"
SELECT "id", "providerKey", "taskType", "inputTokens", "outputTokens",
       "totalTokens", "costKrw", "employeeId", "projectId", "createdAt"
FROM "GatewayCallLog_old";

-- 5. 기존 테이블 제거
DROP TABLE "GatewayCallLog_old";

-- 6. 인덱스 재생성 (파티션 부모에 생성 → 모든 파티션에 자동 적용)
CREATE INDEX "GatewayCallLog_providerKey_createdAt_idx"
    ON "GatewayCallLog" ("providerKey", "createdAt");

CREATE INDEX "GatewayCallLog_taskType_providerKey_idx"
    ON "GatewayCallLog" ("taskType", "providerKey");

COMMIT;
