-- 거버넌스 v2.0 (2026-10-01) 규정 개정 반영
-- 운영규정 제8조⑤, 제10조③, 제11조⑤ / 운영지침 제21조②-5, 제21조④ / 위험관리지침 제4조③

-- Project: 컴플라이언스 검토 추적 + 고영향·고성능 AI 플래그
ALTER TABLE "Project" ADD COLUMN "complianceReviewedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "complianceReviewedBy" TEXT;
ALTER TABLE "Project" ADD COLUMN "isHighImpactAI" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "isHighCapabilityAI" BOOLEAN NOT NULL DEFAULT false;

-- AgentRegistry: 초고위험·에이전트 통제·점검 주기
ALTER TABLE "AgentRegistry" ADD COLUMN "isUltraHighRisk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AgentRegistry" ADD COLUMN "hasInstantShutdown" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AgentRegistry" ADD COLUMN "hasHumanApprovalForAutonomous" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AgentRegistry" ADD COLUMN "reviewCycle" TEXT NOT NULL DEFAULT 'ANNUAL';

-- PolicyDecisionLog: 3년 보관 의무 (운영지침 제21조⑤)
ALTER TABLE "PolicyDecisionLog" ADD COLUMN "retainUntil" TIMESTAMP(3);
