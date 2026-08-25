# AX Hub P0 인증 통합 — 코드 리뷰 결과

**대상 커밋**: `843fd88`
**리뷰일**: 2026-08-21
**변경 파일**: `lib/auth.ts`(수정), `instrumentation.ts`(신설), `middleware.ts`(신설)

---

## 결론

🔴 2건은 머지 전 반드시 수정, 🟠 1건도 지금 고치는 걸 권장합니다. `instrumentation.ts` 관련 미해결 사항 1건은 사실관계 확인으로 해소됐습니다.

---

## 🔴 Critical — matcher 두 번째 패턴이 첫 번째의 예외처리를 무력화

```ts
export const config = {
  matcher: [
    "/api/((?!auth/).*)",                                    // ① /api/auth/* 제외
    "/((?!login|_next/static|_next/image|favicon.ico).*)",   // ② 페이지 보호용
  ],
}
```

matcher 배열의 여러 패턴은 **OR로 합쳐집니다**. ①에서 `/api/auth/session` 같은 NextAuth 자체 엔드포인트를 제외했지만, ②는 `login`으로 시작하는 것만 빼고 나머지 전부를 다시 잡습니다 — `/api/auth/callback/credentials`는 "login"으로 시작하지 않으니 ②에 다시 걸립니다.

**결과**: 로그인하려고 `/api/auth/callback/credentials`를 호출하는 순간, 아직 토큰이 없으니 `authorized: ({token}) => !!token`이 false를 반환 → `/login`으로 리다이렉트 → 그런데 로그인 자체가 이 엔드포인트를 호출해야 성립하니 **로그인이 구조적으로 불가능**해집니다. 테스트 환경에서 바로 걸릴 버그입니다.

### 수정
```ts
export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
}
```
패턴 하나로 합치고 `api/auth`를 최상위 제외 목록에 넣어야 합니다.

---

## 🔴 Critical — 서비스 토큰 인증과 구조적으로 충돌

`withAuth`는 NextAuth의 **쿠키 기반 세션 JWT**를 검사합니다. 그런데 v19에서 설계한 `POST /api/agent-runtime-usage`(배포된 에이전트가 자기 사용량을 Push하는 API, C트랙)는 **브라우저 세션이 아니라 서비스 토큰**으로 인증하는 걸 전제로 했습니다.

지금 이 middleware를 그대로 적용하면:
1. 에이전트가 서비스 토큰을 헤더에 담아 호출해도 쿠키 세션이 없으니 `authorized`가 false
2. 401 JSON이 아니라 **`/login` 페이지로 리다이렉트**됩니다(`withAuth`의 기본 동작) — 에이전트 입장에선 JSON을 기대했는데 HTML이 옵니다
3. C트랙 Push 리포팅이 이 middleware 배포 순간 전부 깨집니다

### 수정 방향
`withAuth`를 그대로 쓰지 말고, 커스텀 미들웨어 함수로 분기해야 합니다.

```ts
export default async function middleware(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith('/api')
  const serviceToken = req.headers.get('x-service-token')

  if (isApi && serviceToken) {
    // 서비스 토큰 검증 로직 (별도) — 통과 시 next()
  }

  const token = await getToken({ req })
  if (!token) {
    return isApi
      ? NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })  // API는 JSON 401
      : NextResponse.redirect(new URL('/login', req.url))                    // 페이지는 리다이렉트
  }
  return NextResponse.next()
}
```

---

## 🟠 High — `TEMP_AUTH_PASSWORD` 타이밍 공격, 지금 고치는 게 맞음

체크리스트에 "미해결"로만 적어놨는데, 이건 **전직원이 공유하는 단일 비밀**이라 뚫리면 피해 범위가 개인 계정 하나가 아니라 회사 전체입니다. 상수시간 비교로 지금 바꾸는 걸 권합니다.

```ts
import { timingSafeEqual } from 'crypto'

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
// password !== tempPassword  →  !safeCompare(password, tempPassword)
```

---

## 🟡 Medium — 로그인 시도 rate limiting 없음 (신규 발견)

`TEMP_AUTH_PASSWORD`가 전사 공유 단일 비밀번호라는 설계와 겹쳐서 더 위험해집니다 — brute force나 credential stuffing을 막을 장치가 코드에 없습니다. NextAuth 자체엔 기본 rate limit이 없으니, `middleware.ts`나 별도 레이어에서 IP/계정 단위 시도 횟수 제한을 추가해야 합니다.

---

## 🟡 Medium — `toSessionUser`에 `employeeId` 누락

확인 결과 `authz.ts`의 `requireRole()`은 세션의 `employeeId`를 직접 안 쓰고 이메일로 DB를 다시 조회해서 자체 재구성하므로 **서버 인가 로직은 안 깨집니다.** 다만 프론트엔드 어딘가에서 `session.user.employeeId`를 직접 참조하는 컴포넌트가 있다면 거기서 `undefined`가 나올 수 있으니, 그런 참조가 있는지 grep 확인을 권합니다.

---

## ✅ 확인됨 — 문제없음

| 항목 | 확인 내용 |
|---|---|
| `instrumentation.ts` experimental 플래그 필요 여부 | Next.js 15부터 stable, `experimental.instrumentationHook` 불필요. Next 16.2.9(본 프로젝트)에서 자동 인식됨 — 체크리스트에서 제거 가능 |
| `bcrypt.compare("", hash)` | else 분기 로직상 안전하다는 체크리스트 서술이 맞음 |
| DEV_BYPASS가 입력값 무시 | 의도된 동작, 문제없음 |
| instrumentation.ts의 Edge 런타임 실행 | `NODE_ENV` 체크는 Edge/Node 양쪽에서 동작. 두 런타임에서 각각 실행돼 총 두 번 호출될 수 있으나 멱등한 체크라 무해함 |

---

## 다음 액션

| 항목 | 우선순위 |
|---|---|
| matcher 패턴 통합 수정 | ★★★ 머지 블로커 |
| 커스텀 미들웨어로 API/페이지 분기 + 서비스 토큰 경로 추가 | ★★★ 머지 블로커 |
| `TEMP_AUTH_PASSWORD` 상수시간 비교 적용 | ★★ 권장, 지금 처리 |
| 로그인 rate limiting 추가 | ★★ 별도 후속 작업으로 가능 |
| `employeeId` 프론트엔드 참조 여부 grep 확인 | ★ |
