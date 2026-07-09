# ETF 멀티 에이전트 시스템 (MAS) 통합 설계

> 문서번호: IT-AX-MAS-001  
> 버전: v1.0 | 2026-07-02  
> 분류: G2 (내부제한)  
> 소관: IT업무개발팀 AX/PI팀 (CTO 초안)

---

## 1. 개요

삼성자산운용 ETF 업무를 지원하는 4개 에이전트로 구성된 MAS 아키텍처.  
Agent D(리서치 센터)가 **데이터 공급 허브** 역할을 맡아, 나머지 3개 에이전트에 검증된 데이터를 제공한다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ETF MAS 전체 구조                             │
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              Agent D: 리서치 센터 (데이터 허브)            │  │
│   │  DART·KRX·뉴스·리포트 수집 → RAG → 출처강제 응답 API       │  │
│   └────────────┬──────────────┬──────────────┬───────────────┘  │
│                │              │              │                   │
│                ▼              ▼              ▼                   │
│   ┌────────────┐  ┌───────────┐  ┌──────────────────┐          │
│   │  Agent A   │  │  Agent B  │  │    Agent C       │          │
│   │ ETF 운용   │  │ ETF 상품  │  │  MH LAB 브리지   │          │
│   │ 시스템     │  │  개발     │  │  (mhlab-etf)     │          │
│   └────────────┘  └───────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 에이전트 목록

| ID | 명칭 | 역할 | 기밀등급 | 위험등급 | 상태 |
|----|------|------|---------|---------|------|
| AX-2026-MAS-001 | Agent A: ETF 운용 시스템 | 포트폴리오 관리, 리밸런싱, NAV 계산 | G2 | 고위험 | Active |
| AX-2026-MAS-002 | Agent B: ETF 상품 개발 | 상품 설계, 백테스팅, 지수 구성 | G2 | 중위험 | Active |
| AX-2026-MAS-003 | Agent C: MH LAB 브리지 | 가상상품·NAV 시뮬레이션, 시연 데이터 | G2 | 중위험 | Active |
| AX-2026-MAS-004 | **Agent D: 리서치 센터** | 데이터 수집·RAG·출처검증 허브 | G2 | 중위험 | **신규 구축** |

---

## 3. Agent D: 리서치 센터 (신규 구축)

### 3.1 배경

- 2026-07-01 ETF 시연에서 데이터 정합성 문제 발생 (출처 없는 AI 생성 수치, 상충 정보 혼재)
- ETF 상품개발 `src/monitoring/media_monitor.py`가 뉴스 수집·경쟁사 모니터링을 독립 모듈로 운영 중
  → 이 기능을 Agent D가 흡수하고, DART·KRX·RAG 검색까지 통합 데이터 허브로 확장
- Agent A~C가 데이터가 필요할 때 Agent D API를 단일 창구로 호출

### 3.2 핵심 기능

| 기능 | 설명 | 현재 위치 | 상태 |
|------|------|---------|------|
| 뉴스·미디어 모니터링 | 삼성자산운용 + 경쟁사 5개사, 14일 모니터링, Executive Brief | `ETF-/src/monitoring/media_monitor.py` | **이전 대상** |
| 공시(DART) 수집 | DART OpenAPI, 공시 자동 수집·인덱싱 | 미구현 | 신규 |
| ETF 유니버스 파이프라인 | KRX ETF 마스터·NAV·구성종목, 일 1회 | 미구현 | 신규 |
| RAG 검색 인터페이스 | 다른 에이전트가 호출 가능한 `/api/research` 엔드포인트 | 미구현 | 신규 |
| 환각 검증 (LLM-judge) | 답변·출처 교차 검증, 신뢰점수 표시 | 미구현 | 신규 |
| 출처 강제 응답 | 출처 없는 응답 시스템 레벨 거부 | 미구현 | 신규 |

### 3.3 흡수 범위 — `media_monitor.py`

현재 `ETF-/src/monitoring/media_monitor.py`(1,676줄)가 수행하는 기능:

- **뉴스 수집**: Google News RSS, LEGACY_DOMAINS(TV·신문·통신사·금융전문지) + NEW_DOMAINS 분류
- **캐시**: `data/cache/media_monitor_latest.pkl` (TTL 20시간) + 전일 비교용 prev 캐시
- **Executive Brief 생성**: Claude Sonnet → `ExecutiveBrief` 데이터클래스 (CEO용 요약)
- **경쟁사 인텔**: `CompetitorIntel` (threat_level, samsung_implication, evidence)

이전 방식:
1. Agent D 내 `research_center/collectors/media.py`로 코드 이전 (로직 동일)
2. ETF 상품개발 `src/monitoring/`은 Agent D API를 호출하도록 리팩토링 (직접 실행 제거)
3. 캐시 경로를 Agent D 공용 `data/cache/`로 통합

### 3.4 데이터 소스

**자동 수집 (파이프라인)**

| 소스 | 주기 | 인터페이스 | 기밀등급 |
|------|------|-----------|---------|
| DART 전자공시 | 실시간 | OpenAPI (무료, opendart.fss.or.kr) | G2 |
| KRX ETF 마스터·NAV | 일 1회 | OpenAPI (data.krx.co.kr) | G2 |
| 뉴스·RSS | 시간 단위 | Google News RSS / feedparser | G1 |
| yfinance 수정주가 | 일 1회 | Python 라이브러리 | G1 |

**수동 업로드**

| 소스 | 주기 | 담당 | 기밀등급 |
|------|------|------|---------|
| 증권사 ETF 리포트 | 수시 | 리서치팀 | G2 |
| 사내 ETF 성과 분석 | 주 1회 | 운용역 | G3 |
| 운용사 운용보고서 | 월 1회 | 운용역 | G3 |

> ⚠️ G3 문서는 Agent D를 통해서도 외부 LLM에 전송 불가. 온프레미스 구축 전까지 RAG 인덱싱 대상 제외.

### 3.5 아키텍처

```
[데이터 수집 레이어]
  ├── DartCollector     → DART OpenAPI → PostgreSQL/Snowflake (G2)
  ├── KrxCollector      → KRX OpenAPI  → PostgreSQL/Snowflake (G2)
  ├── MediaCollector    → RSS/feedparser → PostgreSQL (G1) ← media_monitor.py 이전
  └── ManualUploader    → 파일 업로드 → 검토 → Snowflake (G2/G3)

[벡터 인덱스 (RAG)]
  └── 초기: pgvector (로컬)
      → G2 승인 인프라 확보 후: Snowflake Cortex Search

[API 레이어]
  ├── GET  /api/research/search?q={query}&source={dart|krx|news|report}
  │        → 관련 문서 검색 + Claude 요약 + 출처 인용 반환
  ├── GET  /api/research/brief?period={7d|14d|30d}
  │        → Executive Brief (미디어 모니터링 결과)
  ├── POST /api/research/verify
  │        → { claim, context } → { score, verdict, sources }  (LLM-judge)
  └── GET  /api/research/etf-universe?date={YYYYMMDD}
           → KRX ETF 마스터 + NAV + 구성종목

[출처 강제 원칙]
  모든 응답 = 주장 + [출처: 문서명, 날짜, 섹션]
  출처 없는 단정 → HTTP 422 거부
  신뢰점수 < 0.7 → 응답에 ⚠️ 플래그 표시
```

### 3.6 다른 에이전트 호출 방식

```python
# Agent A (ETF 운용 시스템) 호출 예시
import httpx

RESEARCH_CENTER_URL = "http://research-center:8000"  # Agent D

async def get_etf_benchmark(etf_code: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{RESEARCH_CENTER_URL}/api/research/search",
            params={"q": f"{etf_code} NAV 기준가", "source": "krx"},
            headers={"X-Agent-ID": "AX-2026-MAS-001", "X-Caller": "portfolio-service"}
        )
        resp.raise_for_status()
        return resp.json()  # { answer, sources: [...], trust_score }
```

- 호출 에이전트는 반드시 `X-Agent-ID` 헤더 포함 (감사 추적)
- Agent D는 모든 호출 로그를 `audit_log` 테이블에 기록
- G3 데이터 요청 시 → HTTP 403 + `"reason": "G3_OFFLINE_ONLY"` 반환

### 3.7 Kill Switch

```python
# research_center/circuit_breaker.py
CIRCUIT_BREAKER = {
    "dart_collector":    {"failure_threshold": 3, "recovery_timeout": 180},  # 3분
    "krx_collector":     {"failure_threshold": 3, "recovery_timeout": 180},
    "media_collector":   {"failure_threshold": 5, "recovery_timeout": 300},  # 5분 (비중요)
    "llm_judge":         {"failure_threshold": 3, "recovery_timeout": 120},  # 2분
    "rag_search":        {"failure_threshold": 3, "recovery_timeout": 60},   # 1분
}

# /api/admin/kill-switch (POST) → 즉시 모든 수집 중단, 캐시 응답만 반환
```

### 3.8 구축 단계 (WBS)

| Phase | 기간 | 태스크 | 산출물 |
|-------|------|-------|-------|
| Phase 1 — 이전 + 기반 | 1~2주 | `media_monitor.py` Agent D로 이전, DART·KRX API 연동, PostgreSQL 스키마 | 수집 파이프라인 가동 |
| Phase 2 — RAG | 2~3주 | 문서 임베딩 파이프라인, pgvector 인덱스, 출처 강제 프롬프트 | `/api/research/search` 엔드포인트 |
| Phase 3 — 환각 검증 | 1주 | LLM-judge 구현, 신뢰점수 출력, `/api/research/verify` | 신뢰점수 90%↑ 달성 |
| Phase 4 — 에이전트 연동 | 1주 | Agent A·B·C → Agent D 호출로 교체, 감사 로그 검증 | MAS 통합 완료 |

---

## 4. 에이전트 간 데이터 흐름

```
Agent D (리서치 센터)
  │
  ├──→ Agent B (ETF 상품개발)
  │     - 백테스팅 시 수정주가 요청 → /api/research/etf-universe
  │     - 지수 설계 시 편입 ETF 리서치 → /api/research/search
  │
  ├──→ Agent A (ETF 운용 시스템)
  │     - NAV 계산 시 벤치마크 가격 검증 → /api/research/search
  │     - 리밸런싱 근거 문서 요청 → /api/research/search
  │
  └──→ Agent C (MH LAB 브리지)
        - 시연 데이터 준비 시 공시·시세 조회 → /api/research/etf-universe
        - Executive Brief 요청 → /api/research/brief
```

**단방향 원칙**: Agent A·B·C → Agent D 호출만 허용. Agent D는 다른 에이전트를 능동 호출하지 않는다. (MAS 라우팅 루프 방지)

---

## 5. 거버넌스 적용

| 항목 | Agent D 적용 방식 |
|------|----------------|
| 기밀등급 | G1(뉴스·공개가격) / G2(공시·리포트·NAV) 혼합. G3는 RAG 인덱싱 제외 |
| 위험등급 | 중위험 (AI 답변은 초안, 운용역 확인 후 사용) |
| Kill Switch | `/api/admin/kill-switch` HTTP 엔드포인트 + 소스별 Circuit Breaker |
| 감사 로그 | 모든 호출: caller_agent_id, query, sources_used, trust_score, timestamp |
| 출처 강제 | 출처 미첨부 응답 시스템 레벨 거부 (HTTP 422) |
| Agent ID | AX-2026-MAS-004 (발급 필요) |
| Human Checkpoint | 신뢰점수 < 0.7 응답은 ⚠️ 플래그 + 운용역 확인 권고 |

---

## 6. 리포지토리 구조 (신규)

```
C:\project\research-center\          ← 신규 리포
├── research_center/
│   ├── collectors/
│   │   ├── dart.py                  ← DART OpenAPI
│   │   ├── krx.py                   ← KRX ETF 마스터·NAV
│   │   └── media.py                 ← media_monitor.py 이전
│   ├── rag/
│   │   ├── indexer.py               ← 문서 임베딩 파이프라인
│   │   └── searcher.py              ← pgvector 검색
│   ├── judge/
│   │   └── hallucination.py         ← LLM-judge (신뢰점수)
│   ├── api/
│   │   └── routes.py                ← FastAPI 엔드포인트
│   └── circuit_breaker.py
├── scripts/
│   ├── init_db.py
│   └── daily_collect.py             ← 스케줄러 진입점
├── data/
│   ├── cache/                       ← 수집 캐시 (media_monitor 기존 경로 통합)
│   └── backups/
├── tests/
├── .env.example
└── README.md
```

---

## 7. 즉시 착수 가능한 항목

1. **DART OpenAPI 키 발급** — https://opendart.fss.or.kr (무료, 즉시)
2. **KRX 정보데이터시스템 API 등록** — https://data.krx.co.kr (무료)
3. **`media_monitor.py` 이전** — ETF 상품개발에서 Agent D `collectors/media.py`로 복사 (로직 변경 없음)
4. **Agent ID 발급 요청** — AX팀에 AX-2026-MAS-004 발급 요청
5. **리포지토리 생성** — `C:\project\research-center` 초기화

---

*AX/PI팀 CTO 초안 | 2026-07-02*  
*관련 문서: ETF_리서치센터_구축계획.md | AX_거버넌스_운영모델.md | 가이드라인_AI_거버넌스.md*
