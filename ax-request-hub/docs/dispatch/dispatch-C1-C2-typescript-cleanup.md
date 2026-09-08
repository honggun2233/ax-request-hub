# [C-1/C-2] TypeScript 타입 정리 + 고아 페이지 삭제 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: 기술부채 정리 — 단일 PR
> 선행 조건: 없음 (독립)

---

## C-1. `next-auth.d.ts` — `employeeId` 필드 추가

### 배경
`lib/auth.ts`에 `as any` 캐스팅이 9개 있는데, 전부 `employeeId`가
`next-auth`의 User/Session/JWT 타입에 선언되지 않아서 생긴 것.
`types/next-auth.d.ts`에 한 줄씩 추가하면 전부 사라짐.

### 수정

```ts
// types/next-auth.d.ts — 기존 선언에 employeeId 추가

declare module "next-auth" {
  interface User {
    id: string
    employeeId: string   // 추가
    role: string
    currentLevel: string
    department: string
  }
  interface Session {
    user: {
      id: string
      employeeId: string   // 추가
      email: string
      name: string
      role: string
      currentLevel: string
      department: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    employeeId: string   // 추가
    role: string
    currentLevel: string
    department: string
  }
}
```

### `lib/auth.ts` — `as any` 제거

```ts
// 수정 전
token.employeeId = (user as any).employeeId
token.role = (user as any).role
token.currentLevel = (user as any).currentLevel
token.department = (user as any).department
(session.user as any).id = token.id
(session.user as any).employeeId = token.employeeId
(session.user as any).role = token.role
(session.user as any).currentLevel = token.currentLevel
(session.user as any).department = token.department

// 수정 후 — as any 전부 제거
token.employeeId = user.employeeId
token.role = user.role
token.currentLevel = user.currentLevel
token.department = user.department
session.user.id = token.id
session.user.employeeId = token.employeeId
session.user.role = token.role
session.user.currentLevel = token.currentLevel
session.user.department = token.department
```

---

## C-2. `app/admin/audit/page.tsx` 고아 페이지 삭제

`app/admin/audit/page.tsx`는 사이드바 어디에도 링크되지 않는 고아 페이지.
실제 감사로그는 `/governance`에서 처리됨. 파일 삭제.

```bash
rm ax-request-hub/app/admin/audit/page.tsx
rmdir ax-request-hub/app/admin/audit  # 디렉토리도 비어있으면 삭제
```

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | `lib/auth.ts`에서 `as any` 0건 |
| 2 | TypeScript 빌드 에러 없음 (`npx tsc --noEmit`) |
| 3 | `app/admin/audit/` 디렉토리 삭제됨 |
| 4 | 기존 인증 흐름 동작 이상 없음 |
