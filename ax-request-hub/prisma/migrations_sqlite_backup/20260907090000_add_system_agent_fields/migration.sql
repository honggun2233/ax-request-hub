-- AlterTable: AgentRegistry에 공통 시스템 에이전트 분류 필드 추가 (S-1)
ALTER TABLE "AgentRegistry" ADD COLUMN "isSystemAgent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AgentRegistry" ADD COLUMN "commonAgentType" TEXT;
