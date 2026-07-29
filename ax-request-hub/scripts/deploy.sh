#!/bin/bash
# AX Hub 온프레미스 배포 스크립트
# 사전 요구사항: Node.js 20, PM2, PostgreSQL 16 (DATABASE_URL 설정 필요)
# 초기 PG 배포: docs/deployment.md의 "PostgreSQL 초기 배포 시 주의사항" 참고
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

# standalone 모드 정적 파일 복사 (next.config.ts output: 'standalone' 필수)
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 5. PM2 재시작
pm2 restart ecosystem.config.js --update-env 2>/dev/null || pm2 start ecosystem.config.js

echo "=== 배포 완료 ==="
