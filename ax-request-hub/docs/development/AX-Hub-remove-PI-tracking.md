# AX Hub — PI 성과추적 기능 제거

**작성일**: 2026-08-21
**배경**: PI(프로세스 혁신) 성과 실현 추적은 AX Hub의 3축 거버넌스(에이전트·데이터·토큰) 어디에도 속하지 않는 별개 관리 도메인으로 확인됨. 별도 시스템으로 이관하고 AX Hub에서 제거.

---

## 1. 제거 대상 — 생각보다 깊이 박혀있음

스키마 확인 결과, PI 관련 필드가 `BenefitRecord` 모델 하나가 아니라 **핵심 `Project` 모델에도 직접 필드로 들어가 있습니다.**

```prisma
model Project {
  // ... 기존 필드 ...

  // ▼ 제거 대상 — PI 효과 실현 추적 (v3.2)
  expectedBenefitValue Float?
  expectedBenefitUnit  String?
  benefitRecords       BenefitRecord[]
}

// ▼ 제거 대상 — 모델 전체
model BenefitRecord {
  id            String   @id @default(cuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id])
  agentId       String?
  period        String
  realizedValue Float
  unit          String
  note          String   @default("")
  recordedBy    String
  createdAt     DateTime @default(now())

  @@unique([projectId, period])
}
```

**주의**: `Project.expectedBenefit`(텍스트, "기대효과" — 신청서에서 서술형으로 받는 필드, ROI 점수 산정에 쓰임)는 **제거 대상이 아닙니다.** 제거 대상은 정량화된 `expectedBenefitValue`/`expectedBenefitUnit`(숫자+단위, PI 분기별 추적용)뿐입니다. 이름이 비슷해서 혼동 주의.

---

## 2. 제거 전 확인 절차

```bash
# 1. 실제 사용처 확인 — 그레핑
grep -rn "expectedBenefitValue\|expectedBenefitUnit\|benefitRecords\|BenefitRecord" app/ src/ components/

# 2. 확인 결과에 따라:
#    - 신청 폼(projects/new)에서 입력받고 있다면 → 입력 필드도 같이 제거
#    - 어떤 대시보드/리포트에서 표시하고 있다면 → 그 표시 부분도 제거
#    - 순수 스키마에만 존재하고 UI/API 어디서도 안 쓰인다면 → 스키마만 제거하면 끝
```

---

## 3. 제거 절차

```prisma
// prisma/schema.prisma
// 1) BenefitRecord 모델 전체 삭제
// 2) Project 모델에서 expectedBenefitValue, expectedBenefitUnit, benefitRecords 필드 삭제
```

```bash
npx prisma db push
PRISMA_GENERATE_NO_ENGINE=1 npx prisma generate
```

§2에서 실제 참조 코드가 발견되면, 스키마 변경 전에 해당 UI/API 코드부터 먼저 제거할 것 (참조가 남은 채로 필드를 지우면 빌드 에러).

---

## 4. 이관 안내 (참고용, 이번 작업 범위 아님)

PI 성과추적이 별도 시스템으로 필요하다면, 그 시스템은 AI 에이전트 프로젝트에 국한되지 않고 전사 프로세스 혁신 과제 전체를 다뤄야 하므로 AX Hub의 `Project`(에이전트 등록 신청) 모델에 종속되지 않는 독립 스키마로 설계하는 게 맞습니다. 이번 작업에서는 AX Hub 쪽 제거만 진행하고, 이관 시스템 자체는 별도 논의 대상입니다.

---

## 5. 체크리스트

| 항목 | 완료 |
|---|---|
| §2 grep으로 실제 사용처 확인 | ☐ |
| UI/API 참조 코드 제거 (있는 경우) | ☐ |
| `BenefitRecord` 모델 삭제 | ☐ |
| `Project.expectedBenefitValue/Unit/benefitRecords` 필드 삭제 | ☐ |
| `Project.expectedBenefit`(텍스트) 필드는 유지 확인 — 실수로 같이 지우지 않기 | ☐ |
| `npx prisma db push` + `generate` 실행 | ☐ |
| `npx tsc --noEmit` 확인 | ☐ |
