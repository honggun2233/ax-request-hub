# 삼성자산운용 AX Request Hub

전사 AI 도입 과제를 신청 → 평가 → 에이전트 개발/파일럿 → 협의회 심의 → 상용 전환 → 폐기 전 과정을 단일 시스템에서 추적·거버넌스하는 플랫폼.

| 항목 | 내용 |
|------|------|
| 레포 | `honggun2233/ax-request-hub` (PRIVATE) |
| 포트 | `http://localhost:3005` |
| 프레임워크 | Next.js App Router + Turbopack |
| DB | SQLite (`prisma/dev.db`) — Prisma ORM |
| 인증 | NextAuth.js (Credentials Provider) |
| 스타일 | Tailwind CSS + shadcn/ui |

---

## 빠른 시작

```bash
# 의존성 설치
npm install

# DB 마이그레이션 + 시드
npx prisma migrate deploy
npx prisma db seed

# 부서 쿼터 시드 (별도 실행)
DATABASE_URL="file:./prisma/dev.db" npx ts-node --project tsconfig.json prisma/seed-tools.ts

# 개발 서버 (포트 3005)
PORT=3005 npm run dev
```

---

## 테스트 계정

| 이메일 | 역할 | 설명 |
|--------|------|------|
| `employee@test.com` | EMPLOYEE | 일반 직원 |
| `dept@test.com` | DEPT_HEAD | 부서장 |
| `executive@test.com` | EXECUTIVE | 임원 |
| `dp@test.com` | DATA_PLATFORM | 데이터플랫폼팀 |
| `ax@test.com` | AX_TEAM | AX팀 관리자 |

비밀번호: `password123`

---

## 역할별 주요 화면

### 전 직원 (EMPLOYEE)
| 경로 | 설명 |
|------|------|
| `/` | 홈 — 개인 AI 활동 현황 |
| `/chat` | AI 상담 챗으로 과제 신청 |
| `/projects/new` | 직접 양식으로 과제 신청 (AI 없이) |
| `/me/projects` | 내 과제 현황 |
| `/me` | 프로필 · AI 리터러시 교육 이수 |
| `/me/tools` | 내 AI 도구 계정 |
| `/data/catalog` | 데이터 찾기 · 이용 신청 |
| `/me/data` | 데이터 신청 내역 |
| `/skills` | AI 스킬 라이브러리 |
| `/docs` | 거버넌스 문서 |

### 부서장 (DEPT_HEAD)
| 경로 | 설명 |
|------|------|
| `/dept/tools` | 도구 배정 · 쿼터 (팀원 AI 도구 신청·회수) |

### 경영진 (EXECUTIVE / C_LEVEL)
| 경로 | 설명 |
|------|------|
| `/executive` | 경영 대시보드 — Gate 통과율, 월별 비용, ROI |

### 데이터플랫폼팀 (DATA_PLATFORM)
| 경로 | 설명 |
|------|------|
| `/dp/requests` | 데이터 요청 검토 · 승인 · 제공 처리 |

> **Note:** 데이터 자산 자체는 데이터플랫폼 외부 시스템(Snowflake 등)에서 관리합니다.
> AX Hub는 API를 통해 목록을 읽어 직원에게 보여주기만 합니다.
> PoC 단계에서는 `DataAsset` 테이블을 더미 캐시로 사용합니다.

### AX팀 (AX_TEAM)
| 경로 | 설명 |
|------|------|
| `/admin` | 운영 현황 — 처리 대기 큐, 거버넌스 KPI |
| `/executive` | 경영 대시보드 |
| `/dashboard` | 과제 파이프라인 |
| `/registry` | 에이전트 레지스트리 |
| `/council` | 협의회 기록 |
| `/admin/appeals` | 이의제기 처리 |
| `/admin/employees` | 직원 관리 |
| `/admin/literacy` | 교육 관리 (과정 클릭 → 수강자 상세) |
| `/dept/tools` | 도구 배정 · 쿼터 (전사 통합 관리) |
| `/admin/tokens` | 토큰 한도 · 사용량 |
| `/dp/requests` | 데이터 요청 처리 |
| `/governance` | 감사 로그 |
| `/graph` | 지식 그래프 |

---

## 아키텍처 문서

- `docs/architecture/AX_Hub_전체구조_v1.1.md` — 전체 구조서 (라우트, API, DB 모델, 역할, 서브시스템)
- `docs/api/AX_Hub_API명세서.md` — API 상세 명세

---

## 주요 설계 원칙

1. **PoC 경계 준수** — 운영 DB·실기밀 데이터 사용 금지. 샘플·더미 데이터만.
2. **G3 기밀 통제** — G3 과제는 Claude API 생략, AX팀 수동 검토.
3. **역할 분리** — 개발(CTO/QA) / 현업(운용역/CHRO) / 통제(컴플라이언스·감사) 3축.
4. **데이터 자산 분리** — AX Hub는 데이터 카탈로그 CRUD 담당 아님. 외부 시스템 연동 전까지 더미 캐시 사용.
5. **A/A 원칙** — 에이전트는 PR·초안까지. 머지·배포는 반드시 인표님 승인.
