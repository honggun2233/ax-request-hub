# AX Hub 워크플로우 설계 문서

**작성 기간**: 2026-08-21  
**작성자**: 홍인표 (AX팀)

---

## 문서 목록 (검토 순서)

| 파일 | 내용 |
|---|---|
| `AX-Hub-영향도분석-설계안.md` | 초기 영향도 분석 및 전체 설계안 |
| `AX-Hub-추가검토-조치사항.md` | 추가 검토 조치사항 (1차) |
| `AX-Hub-추가검토-조치사항-final.md` | 추가 검토 조치사항 (최종) |
| `v5` | 통제/활용 분리, 토큰 로깅 |
| `v6` | 리뷰 반영 — 표준 포맷 |
| `v7` | 리뷰 반영 2차 |
| `v8` | Gate 탈락 경로(GateFail 공통 경로) |
| `v9` | SQLite enum 정정, AI 강화 P1 |
| `v10` | Decimal 정정, 보안 승격, 이의제기 정책 |
| `v11` | Qwen3 온프렘 검토 |
| `v12` | 이슈 M/N/O/P 반영 |
| `v13` | AI Gateway 확정 |
| `v14` | ProviderKey 분리(onprem 추가) |
| `v18` | 인프라 이원화 확정 (온프렘 AX Hub ↔ AWS 배포) |
| `v20` | A트랙 엔터프라이즈 API 수집 설계 |
| `v21` | 이슈 CC/DD/EE 반영 (Analytics API, UsageRecordDaily) |
| `v22` | 이슈 JJ/HH 반영 (롤업 타이밍, 인증 단일 티켓) |
| `v23-KKLL반영.md` | 이슈 KK/LL 반영 (롤업 전체 SUM, 개발환경 우회) |
| `v23-KKLL반영-final.md` | **최종본** — 이슈 OO 추가 반영 (instrumentation.ts 차단) |

> v15~v17, v19는 중간 정정 버전으로 최종 반영본에 흡수됨.

---

## 핵심 확정 사항

- **인프라**: AX Hub=온프렘 Qwen(판단·심의), 에이전트 실행=AWS 랜딩존
- **AI**: `ProviderKey: 'anthropic' | 'openai' | 'gemini' | 'onprem'`
- **비용 트랙**: A(엔터프라이즈 API 수집) / B(온프렘 UsageEvent) / C(AWS AgentRuntimeUsage)
- **인증**: auth.ts + middleware.ts + instrumentation.ts 단일 티켓 (★★★ P0)
- **롤업**: UsageRecordDaily(일 단위) → UsageRecord(월 단위) 전체 SUM 방식

## 미결 (구현 대기)

1. ★★★ P0: auth.ts + middleware.ts + instrumentation.ts 인증 통합
2. B트랙 Gateway (ONPREM_LLM_BASE_URL, nl-query 전환, MODEL 환경변수화)
3. A트랙 수집기 (UsageRecordDaily, 롤업 로직, 3개 어댑터)
4. Claude Enterprise Analytics API 키 발급 (Primary Owner → read:analytics)
5. P1 Gate3 채점 근거 (ScoreCard.rationale/suggestion)
