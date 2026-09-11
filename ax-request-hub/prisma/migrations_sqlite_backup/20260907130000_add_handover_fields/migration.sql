-- Migration: add handover request fields to Project
ALTER TABLE "Project" ADD COLUMN "handoverRequestedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "handoverNote" TEXT;
ALTER TABLE "Project" ADD COLUMN "handoverArtifacts" TEXT;
