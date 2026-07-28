# AX Request Hub — 개발자 온보딩 가이드

> 이 문서를 먼저 읽은 뒤 코드를 보세요. 도메인 개념 없이 코드만 보면 맥락을 파악하기 어렵습니다.

---

## 1. 이 시스템이 뭐하는 건가요?

삼성자산운용 전사 AI 도입 과제를 **신청 → 평가 → 데이터 연계 → 개발 → 협의회 심의 → 상용 전환 → 운영/폐기** 전 과정을 하나의 시스템으로 추적·거버넌스합니다.

전체 구조는 `docs/architecture/AX_Hub_전체구조_v1.1.md`를 VS Code에서 열고 `Ctrl+Shift+V`로 미리보기 하세요.
(Mermaid 플로우 다이어그램이 렌더링됩니다 — `bierner.markdown-mermaid` 확장 필요)

---

## 2. 핵심 도메인 용어

코드 전체에서 이 용어들이 반복됩니다. 먼저 익혀두세요.

### 역할 (Role)

| 값 | 의미 | 주요 접근 페이지 |
|----|------|----------------|
| `EMPLOYEE` | 일반 직원 | `/submit`, `/me/*`, `/data/catalog` |
| `DEPT_HEAD` | 부서장 | `/dept/tools` |
| `DATA_PLATFORM` | 데이터플랫폼팀 | `/dp/requests`, `/dp/catalog` |
| `AX_TEAM` | AX팀 (관리자) | 전체 `/admin/*`, `/registry`, `/council` |
| `EXECUTIVE` | C레벨 경영진 | `/executive` (읽기 전용) |
| `C_LEVEL` | 최고경영진 | `/executive` (전체) |

### 에이전트 이중 라이프사이클

에이전트는 **개발(DEVELOPMENT)** 과 **상용(PRODUCTION)** 두 축으로 상태가 관리됩니다.

```
devStage (개발 축)
  SUBMITTED → EVALUATED → GATE1 → GATE2 → GATE3 → PILOT_PROVEN → COUNCIL_PENDING
                                                                         ↓
                                                              협의회 승인 의결
                                                                         ↓
prodStatus (상용 축)
  ACTIVE → SUSPENDED → DEPRECATED → RETIRED
```

- `phase=DEVELOPMENT` 인 동안만 `devStage` 값이 있습니다.
- `phase=PRODUCTION` 전환은 **반드시 협의회(CouncilAgendaItem) APPROVED 의결**이 있어야 합니다. 코드로 우회 불가.
- 두 축은 동시에 존재하지 않습니다 (`devStage IS NULL` ↔ `prodStatus IS NOT NULL`).

### 데이터 프로비저닝

직원이 `/data/catalog`에서 데이터를 신청하면 데이터플랫폼팀이 처리합니다.

```
DataRequest (신청) → REQUESTED → REVIEWING → APPROVED → PROVISIONED
                                           ↘ REJECTED
DataProvision (제공) — 이용기간·연결정보 관리
```

- `ACCESS`: 기존 데이터 이용 신청
- `NEW`: 신규 수집 요청 (수집→적재 후 제공)
- `G3` 기밀 데이터는 정보보호 협의 필수 → `SEC_REVIEW` 상태 경유

### Gate 구조

| Gate | 조건 |
|------|------|
| Gate 1 | 과제 승인 (자동 70점+ 또는 AX팀 수동 승인) |
| Gate 2 | 기술표준 4항목 자가점검 + 데이터 PROVISIONED |
| Gate 3 | 개발 완료·테스트 통과 |
| 협의회 | 파일럿 KPI 실증 1개월 + 상용 운영 계획서 |

---

## 3. 셋업 방법

### 3-1. 환경변수

프로젝트 루트에 `.env.local` 파일을 만드세요.

```bash
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL=http://localhost:3005
NEXTAUTH_SECRET=<32자 이상 임의 문자열>
ANTHROPIC_API_KEY=<Anthropic 콘솔에서 발급>
APPROVAL_THRESHOLD=70
NEXT_PUBLIC_BASE_URL=http://localhost:3005
```

`NEXTAUTH_SECRET` 생성:
```bash
openssl rand -base64 32
# Windows: [System.Convert]::ToBase64String((1..32 | % { [byte](Get-Random -Max 256) }))
```

### 3-2. 설치 및 실행

```bash
npm install
npx prisma db push        # DB 스키마 생성
npx ts-node prisma/seed.ts  # 기초 데이터 시드
npm run dev -- --port 3005
```

브라우저: http://localhost:3005

### 3-3. ⚠️ Prisma + Turbopack 캐시 문제 (반드시 읽으세요)

**증상**: 서버 시작 후 API가 `500 Internal Server Error`, 콘솔에 `Error validating: This line is invalid` 또는 `inlineSchema` 관련 오류.

**원인**: Next.js Turbopack이 `@prisma/client`를 인메모리 번들에 올리기 때문에, `prisma generate` 후에도 디스크의 변경이 즉시 반영되지 않습니다.

**해결 (이미 `next.config.ts`에 적용됨)**:
```ts
// next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client'],  // ← 이 줄이 핵심
}
```
이 설정이 없으면 Prisma 클라이언트가 Turbopack 번들에 묶여 schema 변경이 무시됩니다.

**schema 변경 시 절차**:
1. `prisma/schema.prisma` 수정
2. `npx prisma db push`
3. `npx prisma generate --output ../prisma-client-tmp` (잠금 파일 우회)
4. `prisma-client-tmp/` 의 `.js` 파일을 `node_modules/.prisma/client/` 에 복사 (`.dll.node` 제외)
5. 파일 저장하면 Next.js가 자동 재시작됨

> dev 서버 프로세스를 직접 kill하지 마세요 — OpenClaw/터미널 부모 프로세스 의존성이 있을 수 있습니다.

---

## 4. 테스트 데이터 — 전체 흐름 확인 방법

시드 실행 후 아래 순서로 기능을 확인하세요.

### 테스트 계정

| 이메일 | 비밀번호 | 역할 |
|--------|---------|------|
| admin@samsungam.com | password123 | AX_TEAM |
| dp@samsungam.com | password123 | DATA_PLATFORM |
| dept@samsungam.com | password123 | DEPT_HEAD |
| user@samsungam.com | password123 | EMPLOYEE |

### 시나리오 1: 과제 신청 → 자동 평가 → 파일럿 착수

1. `user@samsungam.com` 로그인 → `/submit` 에서 AI 도입 과제 신청
2. Claude API가 6차원 자동 스코어링 → 70점 이상이면 자동 파일럿 승인
3. `/registry` 에서 `devStage=GATE1` 에이전트 확인 (AX팀 계정 필요)

### 시나리오 2: 데이터 신청 → 제공 처리

1. `user@samsungam.com` → `/data/catalog` 에서 데이터 이용신청
2. `dp@samsungam.com` → `/dp/requests` 에서 신청 처리 (APPROVED)
3. `user@samsungam.com` → `/me/data` 에서 신청 현황 확인

### 시나리오 3: 협의회 심의 → 상용 전환

1. AX팀 계정 → `/registry` 에서 에이전트를 `COUNCIL_PENDING`으로 전환
2. `/council` 에서 안건 상정 및 의결 입력
3. 승인 의결 시 `phase=PRODUCTION, prodStatus=ACTIVE` 자동 전환 확인

### 수동 테스트 데이터 추가 (필요 시)

```bash
# 데이터 자산 시드 (카탈로그 데이터가 없는 경우)
npx ts-node prisma/seed.ts

# DB 직접 확인
npx prisma studio   # 브라우저에서 DB 뷰어 열림
```

---

## 5. 주요 파일 구조

```
app/
├── api/              # API 라우트 (~60개 엔드포인트)
│   ├── data/         # 데이터 신청·제공
│   ├── registry/     # 에이전트 레지스트리
│   ├── council/      # 협의회 심의
│   └── admin/        # 관리자 기능
├── data/catalog/     # 데이터 카탈로그 (직원용)
├── dp/               # 데이터플랫폼팀 처리
├── registry/         # 에이전트 레지스트리
├── council/          # 협의회
└── me/               # 내 정보

lib/
├── prisma.ts         # Prisma 클라이언트 싱글턴
├── auth.ts           # NextAuth 설정
└── authz.ts          # 역할 기반 접근 제어

prisma/
├── schema.prisma     # DB 모델 정의 (30+ 모델)
└── seed.ts           # 초기 데이터

docs/architecture/
├── AX_Hub_전체구조_v1.1.md      # 전체 구조서 (메인 참고 문서)
└── architecture_v3_통합본.md    # v3 상세 아키텍처
```

---

## 6. 자주 묻는 것들

**Q: `NEXTAUTH_SECRET` 없으면?**
A: 로그인은 되는데 세션이 불안정합니다. 반드시 설정하세요.

**Q: Anthropic API 키 없으면?**
A: `/submit` 과제 신청 시 AI 스코어링이 실패합니다. 나머지 기능은 동작.

**Q: 포트를 3000으로 바꾸고 싶으면?**
A: `.env.local`의 `NEXT_PUBLIC_BASE_URL`과 `NEXTAUTH_URL`을 함께 바꾸세요.

**Q: SQLite → PostgreSQL 전환은?**
A: `schema.prisma`의 `provider = "sqlite"` → `"postgresql"` 변경 후 `DATABASE_URL` 교체. Prisma가 나머지 처리.
```
