#!/bin/bash
# AX Hub 온프레미스 배포 스크립트
# 사전 요구사항: Node.js 20, PM2, PostgreSQL 16 (DATABASE_URL 설정 필요)
set -e

echo "=== AX Hub 배포 시작 ==="

# 1. 최신 코드 pull
git pull origin main

# 2. 의존성 설치
npm ci

# 3. DB 마이그레이션
npx prisma migrate deploy

# 4. 빌드
npm run build

# 5. PM2 재시작
pm2 restart ax-hub || pm2 start npm --name ax-hub -- start

echo "=== 배포 완료 ==="
