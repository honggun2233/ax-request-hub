# AX Hub 이관·운영 전환 준비 체크리스트

> 작성일: 2026-09-11  
> 기준 브랜치: main (최종 커밋 e1c5c5b, 2026-09-08)  
> 전환 경로: 로컬 개발(3005) → **내부 개발 서버** → **운영(samsungam.com)**

---

## 0. 현재 상태 요약

| 항목 | 현재 | 이관 목표 |
|---|---|---|
| 실행 환경 | 로컬 Next.js dev (port 3005) | 내부 서버 Node 프로세스 / PM2 |
| DB | SQLite (파일) | PostgreSQL (사내 DB 서버) |
| 인증 | NextAuth (로컬 세션) | NextAuth + SAML/LDAP(삼성 SSO) 또는 사내 SMTP 인증 |
| 도메인 | localhost:3005 | ax-hub.samsungam.com |
| Snowflake | SDK 설치됨, 연결 미구성 | 실계정 연결 + 권한 추적 활성화 |
| AI Gateway | Anthropic 직접 API (개인키) | 사내 AI Gateway 프록시 (Azure OpenAI or Bedrock) |
| 알림(이메일) | nodemailer 미연결 | smtp.samsungam.com |

---

## 1. 내부 개발 서버 이관 (9월 중순 목표)

### 1-1. 인프라 준비 (AI데이터플랫폼팀 협조 필요)

- [ ] Node.js 20+ 설치 확인 (현재 코드 Next 16 기준)
- [ ] PM2 또는 systemd 서비스 등록
- [ ] 방화벽 포트 개방: 3005(개발) → 443(운영)
- [ ] 내부 DNS 등록: `ax-hub-dev.samsungam.com` (개발 서버용)

### 1-2. 데이터베이스 전환 (SQLite → PostgreSQL)

현재 Prisma schema가 `provider = "sqlite"` — 이게 가장 중요한 변경점.

```bash
# 1) schema.prisma datasource 변경
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

# 2) 마이그레이션 생성
npx prisma migrate dev --name init_postgres

# 3) 서버에서 적용
npx prisma migrate deploy
```

- [ ] 사내 PostgreSQL 인스턴스 요청 (AI데이터플랫폼팀)
- [ ] `DATABASE_URL` → `postgresql://ax_hub_user:pass@db-server:5432/ax_hub`
- [ ] pgvector 확장 활성화 (거버넌스 문서 벡터 검색용, 포트 5438 별도)

### 1-3. 환경변수 구성 (.env.production)

`.env.example` 기준으로 실값 채워야 하는 항목:

```env
DATABASE_URL=postgresql://...             # PostgreSQL 실 연결
NEXTAUTH_SECRET=<32자 이상 랜덤>
NEXTAUTH_URL=https://ax-hub-dev.samsungam.com

SMTP_HOST=smtp.samsungam.com
SMTP_PORT=587
SMTP_USER=ax-hub@samsungam.com
SMTP_PASS=<SMTP 계정 비밀번호>

ANTHROPIC_API_KEY=<...>                   # 또는 Azure OpenAI로 전환
APPROVAL_THRESHOLD=70
```

- [ ] IT업무개발팀과 SMTP 발신 계정 생성 요청
- [ ] 비밀값은 코드에 하드코딩 금지 — 서버 환경변수 또는 Vault 사용

### 1-4. 빌드 및 배포

```bash
npm ci
npx prisma generate
npm run build
npm run start        # 또는 PM2 start ecosystem.config.js
```

- [ ] `npm run build` 오류 없음 확인 (TypeScript 빌드)
- [ ] `npm test` 통과 확인
- [ ] `next.config.ts` output 설정 검토 (standalone 모드 권장)

---

## 2. Snowflake 연동 준비

현재 `snowflake-sdk` 설치됨, `feat(c3)` 외부 권한 추적 UI 완료 — **연결 설정만 남은 상태**.

### 2-1. Snowflake 계정 정보 확보

정보전략팀 또는 AI데이터플랫폼팀에 다음 요청:

| 항목 | 내용 |
|---|---|
| Account identifier | `<org>-<account>.snowflakecomputing.com` |
| Warehouse | AX Hub 전용 또는 공용 WH 지정 |
| Database | 접근할 DB 목록 |
| Role | 최소권한 전용 Role (MONITOR 권한 위주) |
| 인증 방식 | 키 페어(권장) or 비밀번호 |

### 2-2. 환경변수 추가

```env
SNOWFLAKE_ACCOUNT=samsungam.ap-northeast-1
SNOWFLAKE_USER=ax_hub_svc
SNOWFLAKE_PRIVATE_KEY_PATH=/etc/ax-hub/snowflake_rsa_key.p8
SNOWFLAKE_WAREHOUSE=AX_HUB_WH
SNOWFLAKE_DATABASE=SAMAM_DW
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_ROLE=AX_HUB_MONITOR
```

### 2-3. 연결 코드 확인

`lib/` 또는 `packages/@ssam/` 내 Snowflake 클라이언트 초기화 코드 위치 확인 후:

- [ ] 연결 테스트 (`SHOW WAREHOUSES` 쿼리 실행)
- [ ] 외부 권한 추적 쿼리 (`INFORMATION_SCHEMA.OBJECT_PRIVILEGES`) 실행 확인
- [ ] Policy Gateway WARN 트리거 확인 (고위험 데이터 접근 시 경고)

### 2-4. Snowflake 보안 검토

- [ ] IP 화이트리스트 등록 (사내 서버 IP → Snowflake 접속 허용)
- [ ] 읽기 전용 Role 확인 (INSERT/UPDATE/DELETE 권한 없음)
- [ ] DMS AI분류 규칙: Snowflake의 CONFIDENTIAL 데이터는 외부 LLM 전송 차단 설정 필수

---

## 3. 사내 시스템 연동

### 3-1. SSO / 인증

현재 NextAuth 이메일 기반. 사내 전환 옵션:

| 방식 | 난이도 | 권장 여부 |
|---|---|---|
| 사내 SMTP 인증 유지 | 낮음 | 단기 운영용 |
| SAML 2.0 (삼성 IDP) | 높음 | 운영 목표 |
| LDAP/AD 연동 | 중간 | 중기 전환 |

- [ ] 단기: `@samsungam.com` 이메일 도메인 제한으로 내부 인원만 가입 가능하도록 NextAuth callback 추가
- [ ] 중기: IT업무개발팀과 SAML 연동 논의

### 3-2. 위원회 연동 (Policy Gateway Phase 2)

현재 CONFIDENTIAL 과제 신청 시 위원회 안건 자동 생성됨.  
실운영에서 실제 연동 필요:

- [ ] 위원회 구성원 이메일 목록 → SMTP 발송 테스트
- [ ] 위원회 회신 처리 플로우 확인 (승인/반려 콜백 URL)
- [ ] Admin 페이지 구현 필요 (현재 stub 상태) — 위원회 결과 입력 UI

### 3-3. AWS Glue 연동

`feat(c3)` 에서 외부 권한 추적 대상으로 포함됨:

- [ ] AWS 자격증명 (IAM Role 또는 Access Key) 환경변수 설정
- [ ] Glue Data Catalog 접근 권한 확인
- [ ] 데이터 분류 결과가 Policy Gateway에 반영되는지 E2E 확인

---

## 4. 운영 전환 (최종 단계)

### 4-1. Admin 기능 구현 (현재 stub)

운영 전 반드시 완성 필요:

- [ ] 어드민 대시보드 — 전체 과제 현황, 스코어 분포
- [ ] 위원회 안건 결과 입력 UI
- [ ] 사용자 권한 관리 (AX팀 / 심사자 / 일반 사용자)
- [ ] 감사 로그 조회 UI

### 4-2. 운영 도메인 전환

```env
NEXTAUTH_URL=https://ax-hub.samsungam.com
NEXT_PUBLIC_BASE_URL=https://ax-hub.samsungam.com
```

- [ ] SSL 인증서 발급 (사내 CA 또는 Let's Encrypt)
- [ ] Nginx/리버스 프록시 설정

### 4-3. 모니터링 · 장애 대응

- [ ] PM2 로그 설정 (`/var/log/ax-hub/`)
- [ ] 헬스체크 엔드포인트 확인 (`/api/health`)
- [ ] 슬랙/이메일 알림 연동 (서버 다운 시)
- [ ] DB 백업 스케줄 설정

---

## 5. 순서 확인 — 맞습니다

```
[현재] 로컬 개발(3005)
    ↓
[9월 중순] 내부 개발 서버 이관
    · DB PostgreSQL 전환  ← 가장 먼저
    · 환경변수 실값 구성
    · 빌드 배포 확인
    · Snowflake 연결 테스트
    · SSO 도메인 제한
    ↓
[10월 초] 내부 파일럿 (AX팀 + 일부 부서)
    · 위원회 연동 E2E 테스트
    · Admin 기능 완성
    · QA / 사용자 피드백 반영
    ↓
[10월 말] 전사 운영 가동
    · SAML/SSO 전환 (중기)
    · SLA / 모니터링 체계
```

---

## 6. 즉시 해야 할 것 (이번 주)

1. **AI데이터플랫폼팀에 요청** — 개발 서버 (Node 환경) + PostgreSQL 인스턴스 + 방화벽
2. **IT업무개발팀에 요청** — SMTP 발신 계정 (`ax-hub@samsungam.com`)
3. **정보전략팀에 요청** — Snowflake 전용 서비스 계정 + Role
4. **내부 코드 작업** — Prisma schema PostgreSQL 전환 PR 생성

Admin 페이지는 이관 후 파일럿 기간 중 완성해도 됩니다.  
단, **PostgreSQL 전환 + 환경변수 구성 + Snowflake 연결**은 이관 전에 반드시 선행돼야 합니다.
