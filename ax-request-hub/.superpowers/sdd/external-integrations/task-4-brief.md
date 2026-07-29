# Task 4 Brief: WS-D — PostgreSQL 전환 + 온프레미스 배포 준비

## 목표
Prisma datasource를 PostgreSQL로 전환하고, 온프레미스 배포를 위한 스크립트/문서를 준비한다.
실제 PostgreSQL 서버 없음 — 코드/스크립트만 준비. migrate dev 실행 불가.

## 작업 디렉토리
`/c/project/_cto/ax-hub/ax-request-hub/` (git worktree, 브랜치: feat/external-integrations)

## 현재 next.config.ts
```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client'],
};
export default nextConfig;
```

## 현재 prisma/schema.prisma datasource
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

## 구현 사항

### 1. prisma/schema.prisma 변경
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
- 기존 schema.prisma.bak 파일이 있으면 SQLite 백업으로 유지 (수정하지 말 것)
- provider만 변경, 나머지 모델은 그대로

### 2. npx prisma generate 실행 (migrate dev는 PostgreSQL 서버 필요 → 스킵)
```bash
cd /c/project/_cto/ax-hub/ax-request-hub
npx prisma generate
```
Prisma Client가 PostgreSQL용으로 재생성됨.

### 3. next.config.ts 수정
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
```

### 4. scripts/deploy.sh 신규 작성
```bash
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
```
- chmod +x scripts/deploy.sh 권한 설정

### 5. .env.example에 추가할 섹션 (기존 파일에 추가)
```env
# --- PostgreSQL (WS-D, 온프레미스 배포용) ---
# 개발환경: DATABASE_URL=file:./dev.db (SQLite)
# 프로덕션: 아래 PostgreSQL URL 사용
DATABASE_URL=postgresql://ax_user:your-password@localhost:5432/ax_hub
```
(기존 DATABASE_URL=file:./dev.db 라인 주석 처리하고, PostgreSQL URL 추가)

### 6. docs/deployment.md 신규 작성
다음 내용 포함:

```markdown
# AX Hub 온프레미스 배포 가이드

## 사전 요구사항
- Node.js 20 LTS
- PM2 (`npm install -g pm2`)
- PostgreSQL 16
- Nginx

## 환경변수 설정 (.env.production)
서버에서 `.env.production` 파일 생성 (git 제외):
```env
DATABASE_URL=postgresql://ax_user:password@localhost:5432/ax_hub
NEXTAUTH_SECRET=<강력한-랜덤-문자열>
NEXTAUTH_URL=https://ax-hub.samsung.com
ANTHROPIC_API_KEY=...
NOTIFY_CHANNEL=knox
KNOX_API_ENDPOINT=...
KNOX_API_KEY=...
```

## PM2 설정 (ecosystem.config.js)
```javascript
module.exports = {
  apps: [{
    name: 'ax-hub',
    script: '.next/standalone/server.js',
    env_file: '.env.production',
    instances: 1,
    autorestart: true,
  }]
}
```

## Nginx 설정 예시
```nginx
server {
    listen 443 ssl;
    server_name ax-hub.internal;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 초기 배포
```bash
git clone https://github.com/honggun2233/ax-request-hub.git
cd ax-request-hub
cp .env.example .env.production
# .env.production 편집
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## 업데이트 배포
```bash
./scripts/deploy.sh
```
```

## Global Constraints
- 실제 비밀값 절대 코드에 넣지 말 것
- prisma/schema.prisma.bak 파일 수정하지 말 것
- migrate dev 실행하지 말 것 (PostgreSQL 서버 없음)
- TypeScript strict 준수
- 한국어 주석 허용

## 리포트
완료 후 `/c/project/_cto/ax-hub/ax-request-hub/.superpowers/sdd/external-integrations/task-4-report.md`에 작성:
- 상태: DONE | DONE_WITH_CONCERNS | BLOCKED
- 커밋 해시
- `npx prisma generate` 결과
- tsc 결과 1줄
- 우려 사항
