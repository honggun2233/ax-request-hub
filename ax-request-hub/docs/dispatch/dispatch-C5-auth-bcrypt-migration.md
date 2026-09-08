# [C-5] TEMP_AUTH_PASSWORD → bcrypt 완전 전환 — 착수 지시서

> 작성: Claude AI / 2026-09-07
> 대상: Jarvis (CTO 에이전트)
> 분류: 보안 — 임시 패스워드 제거
> ⚠ 운영 작업 포함 — 머지 전 인표님 확인 필수

---

## 배경

`lib/auth.ts`의 인증 로직이 3단계 fallback 구조:

```
1. TEMP_AUTH_PASSWORD env 변수 있으면 → 전직원 동일 임시 패스워드로 인증
2. emp.password(bcrypt 해시) 있으면 → 개인 bcrypt 검증
3. 둘 다 없으면 → 로그인 거부
```

`TEMP_AUTH_PASSWORD`가 env에 설정된 상태라면 bcrypt 경로가 완전히 무시됨.
SSO/LDAP 연동 전까지의 임시 조치였으나, 운영 중인 현재도 공유 패스워드 사용 중이면
계정 탈취 시 전직원 계정이 동시에 노출되는 구조.

**현재 `Employee.password` 실태 확인 필요** — 아래 DB 조회를 먼저 실행:

```ts
// 운영 DB 조회 — 읽기 전용
const stats = await prisma.employee.groupBy({
  by: ['password'],
  _count: true,
})
// '' (빈 문자열, default) vs bcrypt 해시($2b$...) 분포 확인
```

---

## 전환 절차

### Step 1. DB 조회로 현황 파악 (Jarvis → 인표님 보고)

- 전체 직원 중 `password=''`(미설정) 비율
- `password` 필드가 bcrypt 해시(`$2b$`로 시작)인 직원 수
- 이 비율에 따라 Step 2 전략 결정

### Step 2a. 대부분이 빈 문자열인 경우 → 일괄 초기 비밀번호 발급

```ts
// 각 직원에게 임시 개인 bcrypt 패스워드 생성 후 email로 발송
// (Knox 메시지 또는 사내 메일)
import bcrypt from 'bcryptjs'

const employees = await prisma.employee.findMany({
  where: { password: '' },
  select: { id: true, email: true, name: true },
})

for (const emp of employees) {
  // 직원별 임시 패스워드 = 사번 또는 생성 규칙 (인표님 결정 필요)
  const tempPw = generateTempPassword(emp)
  const hash = await bcrypt.hash(tempPw, 10)
  await prisma.employee.update({
    where: { id: emp.id },
    data: { password: hash },
  })
  // 이메일/Knox 알림으로 임시 패스워드 안내
}
```

### Step 2b. bcrypt 해시가 이미 설정된 경우 → env 변수만 제거

`.env`에서 `TEMP_AUTH_PASSWORD=` 라인 제거 또는 주석 처리.
재배포 후 bcrypt 경로로 자동 전환.

### Step 3. 코드 정리 (Step 2 완료 후)

```ts
// lib/auth.ts — TEMP_AUTH_PASSWORD 분기 제거
// Before:
const tempPassword = process.env.TEMP_AUTH_PASSWORD
if (tempPassword) {
  if (!safeCompare(password, tempPassword)) return null
} else if (emp.password) {
  const valid = await bcrypt.compare(password, emp.password)
  if (!valid) return null
} else {
  return null
}

// After (단순화):
if (!emp.password) return null
const valid = await bcrypt.compare(password, emp.password)
if (!valid) return null
```

---

## 완료 조건

| # | 확인 항목 |
|---|---|
| 1 | DB 조회 결과 인표님 보고 완료 |
| 2 | 모든 Employee.password에 bcrypt 해시 설정됨 (빈 문자열 0건) |
| 3 | TEMP_AUTH_PASSWORD env 변수 제거됨 |
| 4 | lib/auth.ts에서 tempPassword 분기 코드 제거됨 |
| 5 | 기존 계정으로 로그인 정상 동작 확인 |

---

## 주의

- Step 2a(일괄 초기 패스워드 발급)는 **인표님 승인 후 실행** — 전직원 인증 방식이 바뀌는 작업
- SSO/LDAP 연동이 확정되면 이 작업 전체가 불필요해질 수 있음 — 연동 일정 우선 확인 권장
