# [C-5 Step 3] TEMP_AUTH_PASSWORD 분기 코드 제거 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 선행 완료: C-5 Step 2a (전직원 13명 bcrypt 설정 완료, 빈 비밀번호 0건 확인)
> 처리: PR #75(C-1/C-2)에 추가 커밋으로 붙일 것 — 같은 파일(lib/auth.ts) 수정이라 분리 불필요

---

## 배경

C-5 Step 2a 완료로 모든 Employee.password가 bcrypt 해시 상태. TEMP_AUTH_PASSWORD
env 변수도 제거 예정. 코드에서 해당 분기를 깔끔하게 제거한다.

---

## 수정 1. `lib/auth.ts` — 인증 로직 단순화

```ts
// 제거 대상 — safeCompare 함수 전체
/** 타이밍 어택 방지 — TEMP_AUTH_PASSWORD 평문 비교에 사용 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
```

```ts
// 제거 대상 — timingSafeEqual import (safeCompare 제거 후 미사용)
import { timingSafeEqual } from "crypto"
```

```ts
// 수정 전 (3단계 fallback)
const tempPassword = process.env.TEMP_AUTH_PASSWORD
if (tempPassword) {
  if (!safeCompare(password, tempPassword)) return null
} else if (emp.password) {
  const valid = await bcrypt.compare(password, emp.password)
  if (!valid) return null
} else {
  return null
}

// 수정 후 (bcrypt 단일 경로)
if (!emp.password) return null
const valid = await bcrypt.compare(password, emp.password)
if (!valid) return null
```

---

## 수정 2. `lib/auth.ts` — C-1에서 아직 남은 `as any` 제거 (PR #75와 같이 처리)

PR #75(C-1/C-2)가 `next-auth.d.ts`에 `employeeId` 추가를 포함하므로,
이 커밋에서 `lib/auth.ts`의 `as any` 9개도 함께 제거:

```ts
// jwt callback — as any 제거
token.employeeId = user.employeeId
token.role = user.role
token.currentLevel = user.currentLevel
token.department = user.department

// session callback — as any 제거
session.user.id = token.id
session.user.employeeId = token.employeeId
session.user.role = token.role
session.user.currentLevel = token.currentLevel
session.user.department = token.department
```

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | `lib/auth.ts`에서 `safeCompare` 함수 제거됨 |
| 2 | `timingSafeEqual` import 제거됨 |
| 3 | `TEMP_AUTH_PASSWORD` 분기 코드 제거됨 |
| 4 | `lib/auth.ts`에서 `as any` 0건 |
| 5 | `npx tsc --noEmit` 에러 0건 |
| 6 | 기존 계정으로 로그인 정상 동작 (bcrypt 경로만 남음) |

---

## 주의

- `.env`에서 `TEMP_AUTH_PASSWORD=` 라인 제거는 **인표님이 직접** 운영 서버에서 처리
- 코드에서 분기만 제거하면 env 변수가 남아도 참조 코드가 없어서 무해함
