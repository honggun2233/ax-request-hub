# 거버넌스 문서 버전 운영 가이드

> 최종 갱신: 2026-07-28

---

## 두 버전의 존재 이유

AX 거버넌스 문서는 **Full**과 **SLIM** 두 버전을 독립 병렬로 운영합니다.
SLIM은 Full의 요약본이 아닙니다. 목적과 독자가 다른 별도 버전입니다.

| 구분 | Full | SLIM |
|------|------|------|
| 위치 | `governance/full/` | `governance/slim/` |
| 목적 | 규정 완결성 · 법적 근거 · 감사 대응 | 현업 실무 적용 · 의사결정 즉시 참조 |
| 독자 | 규정 담당자 · 컴플라이언스 · 감사 | 과제 담당자 · 개발자 · 현업 |
| 분량 | 제약 없음 (전조항 기술) | 핵심 의사결정 기준만 (불필요 조항 제외) |
| 개정 | 정책 변경 시 선행 개정 | Full 개정 후 SLIM 검토·반영 |
| 형식 | 조문 형식 유지 | 조문 형식 유지 (표현만 간결화) |

---

## 핵심 원칙

- **SLIM이 더 실용적이어도 Full이 우선합니다.** 해석이 충돌하면 Full 기준.
- **SLIM은 줄이는 것이 아니라, 덜어내는 것입니다.** 배경 설명·운영 세부사항·다른 문서에서 커버되는 내용을 제거합니다.
- **두 버전은 함께 수정합니다.** Full만 고치고 SLIM을 방치하면 버전 불일치 발생.
- **SLIM-DIFF.md로 차이를 추적합니다.** 어떤 조항이 왜 제외됐는지 기록을 유지합니다.

---

## 문서 파일 대응표

| 문서 | Full | SLIM |
|------|------|------|
| AI 운영규정 | `full/AX-REGULATION-2026-001_AI운영규정.md` | `slim/AX-REGULATION-SLIM.md` |
| AI 거버넌스 지침 | `full/AX-POLICY-2026-001_AI거버넌스지침.md` | `slim/AX-POLICY-SLIM.md` |
| AI 운영기준 (별표) | `full/AX-STANDARD-2026-001_운영기준.md` | — (SLIM 없음, 수치 SSOT) |
| AI 운영위원회규정 | `full/AX-COMMITTEE-2026-001_AI운영위원회규정.md` | `slim/AX-COMMITTEE-SLIM.md` |
| 사용 가이드라인 | `full/AX-MANUAL-2026-001_사용가이드라인.md` | `slim/AX-MANUAL-SLIM.md` |
| 전사 AI 운영 제안 | (원문 proposals/) | `slim/AX-PROPOSAL-SLIM.md` |

> ⚠️ **`AX-GUIDELINE-2026-001` 폐지 (2026-07-28)**: REGULATION에 통합 흡수됨.
> archive/deprecated/ 로 이동. SLIM의 `AX-GUIDELINE-SLIM.md`도 폐지 처리 필요.

---

## 개정 절차

1. Full 문서 수정
2. `meta/CHANGELOG.md` Full 개정 내역 기록
3. SLIM 문서 검토 — 영향 받는 조항 있으면 SLIM도 수정
4. `meta/SLIM-DIFF.md` 조항 비교표 업데이트
5. PR 생성 후 AX팀장 승인
