-- Migration: add selectedCommonAgents to Project
ALTER TABLE "Project" ADD COLUMN "selectedCommonAgents" TEXT;
