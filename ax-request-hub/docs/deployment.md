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
    ssl_certificate /etc/ssl/certs/ax-hub.crt;         # 실제 인증서 경로로 교체
    ssl_certificate_key /etc/ssl/private/ax-hub.key;   # 실제 키 경로로 교체

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 배포 절차

### 빌드 및 정적 파일 복사
Next.js `output: 'standalone'` 모드에서는 빌드 후 정적 파일을 standalone 디렉토리로 복사해야 합니다:

```bash
npm run build

# standalone 모드 정적 파일 복사 (필수)
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

### PM2 ecosystem.config.js 사용
직접 `npm start` 대신 `ecosystem.config.js`를 통해 PM2를 관리합니다:

```bash
# 최초 시작
pm2 start ecosystem.config.js

# 재시작 (환경변수 갱신 포함)
pm2 restart ecosystem.config.js --update-env
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
