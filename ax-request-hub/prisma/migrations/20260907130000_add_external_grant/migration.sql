-- AlterTable: DataProvision에 외부 데이터 소스 권한 확인 필드 추가
ALTER TABLE "DataProvision" ADD COLUMN "externalGranted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DataProvision" ADD COLUMN "externalGrantedAt" DATETIME;
ALTER TABLE "DataProvision" ADD COLUMN "externalGrantedBy" TEXT;
