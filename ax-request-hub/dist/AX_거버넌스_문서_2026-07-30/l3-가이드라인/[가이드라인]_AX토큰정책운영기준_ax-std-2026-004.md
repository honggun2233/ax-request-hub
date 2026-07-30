# AX 토큰 정책 운영 기준

문서 번호: AX-GUI-2026-005  
분류: 지침 (L2)  
보안등급: G2 (내부)  
작성: AX팀  
승인: AX팀장  
버전: v1.0  
시행일: 2026-07-23

---

## 1. 목적 및 적용 범위

AI 도구의 토큰 사용량 배분·모니터링·알림 기준을 명시하여 전사 AI 비용을 통제하고 공정한 자원 배분을 실현한다.

**적용 대상:** AX팀(정책 수립·관리), 부서장(부서 배분 집행), 전 직원(사용량 확인)

---

## 2. 토큰 배분 체계

### 2-1. 배분 계층 구조

```
AX팀 (전사 쿼터 총괄)
    │
    ├── 레벨별 기본 정책 (TokenPolicy)
    │       L0: 0 / L1: 100K / L2: 300K / L3: 700K / L4: 협의
    │
    ├── 서비스별 배분 정책 (DistributionPolicy)
    │       레벨 × 서비스명 조합으로 개인 서비스 할당
    │
    └── 부서별 AI 도구 쿼터 (DepartmentQuota)
            부서장이 관리; 도구별 총 계정 수 제한
```

### 2-2. 토큰 정책 유형 (TokenPolicy.scope)

| scope | 대상 | 설명 |
|-------|------|------|
| `GLOBAL` | 전사 | 서비스 전체 월 상한 (AX팀 관리) |
| `LEVEL` | 레벨별 | L0~L4 각 레벨 월 한도 |
| `EMPLOYEE` | 개인 | 특정 직원 예외 한도 (확장 또는 제한) |

### 2-3. 배분 우선순위

1. `EMPLOYEE` scope 정책이 있으면 해당 직원에게 최우선 적용
2. 없으면 `LEVEL` scope 정책 적용 (직원의 `currentLevel` 기준)
3. 서비스별 `GLOBAL` 상한 내에서 개별 한도 적용

### 2-4. 부서별 AI 도구 쿼터 (DepartmentQuota)

| 필드 | 설명 |
|------|------|
| `department` | 부서명 |
| `toolType` | GPT_CHAT / GPT_EXCEL / GEMINI |
| `totalQuota` | 부서 내 최대 계정 수 |
| `aiDensity` | HIGH (AI집중부서) / MEDIUM / STANDARD |
| `managedBy` | 부서장 이메일 (배정 권한자) |

**쿼터 설정 절차:**
1. AX팀이 부서 AI 활용도(`aiDensity`) 평가
2. 연간 계정 예산에 따라 부서별 쿼터 책정
3. `/admin/tools/quota` POST로 등록
4. 부서장이 `/dept/tools` 페이지에서 쿼터 범위 내 배정 집행

---

## 3. 서비스 할당 운영 (ServiceAllocation / DistributionPolicy)

### 3-1. 서비스 할당 기준

레벨별 서비스 접근 권한은 `DistributionPolicy`에 `level × serviceName` 조합으로 정의한다.

| level | serviceName | 설명 |
|-------|-------------|------|
| L1 | ChatGPT Basic | ChatGPT 기본 플랜 접근 |
| L2 | ChatGPT Plus | ChatGPT Plus 플랜 접근 |
| L3 | Gemini Enterprise | Gemini Enterprise 접근 |
| L4 | All Services | 전 서비스 + 확장 한도 |

### 3-2. 할당 절차

1. AX팀이 `DistributionPolicy`에 레벨-서비스 매핑 등록
2. 직원이 `LevelApplication` 승인 → `Employee.currentLevel` 업데이트
3. AX팀이 `/api/admin/distribution` POST (action: grant)로 `ServiceAllocation` 생성
4. 직원은 `/me/services`에서 본인 할당 서비스 확인

### 3-3. 할당 회수 기준

| 사유 | 처리 |
|------|------|
| 레벨 하향 심사 결과 | `ServiceAllocation.status = REVOKED`, 상위 레벨 서비스 즉시 회수 |
| 퇴직·장기 휴직 | `Employee.isActive = false` 처리 후 할당 자동 비활성화 |
| 보안 사고 발생 | AX팀 즉시 회수, AuditLog 기록 |
| 부서 이동 | 부서 변경 후 30일 내 재심사 (aiDensity 변동 가능) |

---

## 4. 토큰 사용량 모니터링 (UsageRecord / UsageAlert)

### 4-1. 사용량 기록 구조

- `UsageRecord`: 직원×서비스×연월 단위 누적 토큰 수 + 비용(원화)
- 동일 `[employeeId, service, yearMonth]` 조합은 유일 (upsert로 누적)
- 입력 주체(`inputById`): AX팀 관리자 또는 자동 수집 스크립트

### 4-2. 알림 임계값 운영 기준 (UsageAlert)

| alertType | 발동 조건 | 조치 |
|-----------|-----------|------|
| `MONTHLY_WARNING` | 월 한도의 `warningThreshold`% 초과 (기본 80%) | AX팀·직원 알림 |
| `MONTHLY_EXCEEDED` | 월 한도 100% 초과 | 즉시 AX팀 알림, 해당 서비스 일시 제한 검토 |
| `SINGLE_CALL_WARNING` | 단일 호출 토큰이 `singleCallLimit` 초과 | AX팀 알림 |

**알림 확인 / 해소:**
- AX팀이 `/admin/tokens` 페이지에서 미확인 알림 모니터링
- `UsageAlert.acknowledged = true`로 처리하면 대시보드에서 제거

### 4-3. 월별 비용 집계

- `UsageRecord.costKrw` 필드에 토큰당 비용(원화)을 환산하여 기록
- 환율·모델 변경 시 AX팀이 기준 단가를 업데이트하고 과거 데이터 재산정은 별도 협의
- `/api/executive` GET에서 최근 6개월 월별 비용 트렌드를 집계하여 경영진 대시보드에 제공

---

## 5. 회수 기준 및 절차 요약

| 사유 | 처리 경로 | 기한 |
|------|-----------|------|
| 레벨 하향 | admin/level PATCH → ServiceAllocation REVOKED | 즉시 |
| 퇴직 | admin/employees → isActive=false | 인사 처리일 |
| 보안 사고 | AX팀 직접 회수 → AuditLog | 24시간 이내 |
| 연간 재심사 | 매년 1월 전 직원 레벨·할당 검토 | 1월 말 기준 |

---

## 6. DistributionPolicy 적용 규칙

1. **레벨 인상 시 자동 확장 아님** — 레벨이 올라도 `ServiceAllocation`은 AX팀이 수동으로 생성한다. 자동 할당은 미구현.
2. **정책 비활성화** — `isActive = false`로 처리하면 신규 할당이 막히나 기존 할당(`ServiceAllocation`)은 유효.
3. **중복 방지** — `@@unique([level, serviceName])`으로 동일 레벨-서비스 정책 중복 등록 불가.
4. **정책 변경 이력** — 정책 변경 시 AX팀이 AuditLog에 변경 사유 기록.

---

## 7. 관련 시스템

| 항목 | 위치 |
|------|------|
| 토큰 정책 관리 | `/admin/tokens` (AX팀) |
| 배분 정책 관리 | `/admin/distribution` (AX팀) |
| 부서 쿼터 설정 | `/admin/tools/quota-setup` (AX팀) |
| 내 토큰 사용 현황 | `/me/usage` (전 직원) |
| 내 할당 서비스 | `/me/services` (전 직원) |
| 관련 API | `/api/admin/tokens`, `/api/admin/distribution`, `/api/usage` |
| DB 모델 | `TokenPolicy`, `UsageRecord`, `UsageAlert`, `ServiceAllocation`, `DistributionPolicy`, `DepartmentQuota` |

---

*최초 작성: 2026-07-23*
