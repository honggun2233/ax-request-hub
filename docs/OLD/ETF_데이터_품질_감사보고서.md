# ETF 데이터 품질 감사보고서

> **작성:** CDO | **감사일:** 2026-07-02 | **감사 범위:** ETF 3개 시스템 | **계기:** 2026-07-01 시연 데이터 정합성 이슈
>
> **인표님 원칙:** "데이터들이 제대로 쌓이고 있어야 쓸모 있는 데이터가 되는 거야. 쓰레기로 만들면 안 된다."

---

## 1. 현황 요약

### 1-1. 시스템별 저장 방식

| 시스템 | 저장소 | 스키마 관리 | 타임스탬프 | Mock/실데이터 구분 |
|--------|--------|------------|------------|-------------------|
| ETF 운용시스템 (Spring) | PostgreSQL (서비스별 분리 DB) | Flyway 마이그레이션 | TIMESTAMPTZ (UTC) | `source='MOCK'` 컬럼 존재 |
| MH LAB ETF (Python) | SQLite (data/mhlab.sqlite) | 코드 내 DDL + 트리거 | ISO-8601 UTC 문자열 | 없음 (코드 주석만) |
| ETF 상품개발 (Streamlit) | Pickle/JSON 파일 캐시 (DB 없음) | 없음 | timezone-naive datetime | 없음 |

### 1-2. 감사 핵심 발견 사항

#### [시스템 1] ETF 운용시스템 (Spring) — `C:\project\ETF 운용 시스템 개발 project`

- **Mock 시드 데이터가 운용 테이블에 직접 삽입됨.** `V2__seed_prices.sql`이 `latest_prices` 테이블에 `source='MOCK'` 가격을 `ON CONFLICT DO UPDATE`로 INSERT한다. 이 테이블은 운용 중 실시간 시세 조회 대상이므로 Mock 가격이 실 운용 로직에 유입될 수 있다.
- **`holding_positions` 테이블이 갱신형(update-in-place)으로 설계되어 포지션 이력 복원 불가.** `updated_at` 컬럼만 있고 point-in-time 이력 테이블이 없다. 리밸런싱 직전 포지션 복원이 불가능하다.
- **`stock_price_history`(risk-analytics) 및 `risk_metrics` 테이블에 데이터 소스 컬럼 없음.** 계보 추적 불가.
- **`etf_navs` 테이블에 수정주가 사용 여부 컬럼 없음.** NAV 계산이 수정종가 기반인지 확인할 방법이 없다.
- **로컬 개발 기본 비밀번호가 application.yml에 하드코딩.** (`market_pass` 등)

#### [시스템 2] MH LAB ETF (Python) — `C:\project\mhlab-etf`

- **실제 DB 파일(data/mhlab.sqlite)이 존재하지 않음.** `data/` 폴더 전체가 `.gitignore` 대상이며, 실제 파일이 없다. 시연 당일 어떤 데이터로 동작했는지 재현 불가.
- **Mock/샘플 데이터를 실 DB와 구분하는 컬럼 없음.** `seed_sample.py`가 "KODEX형 더미 바스켓"임을 코드 주석으로만 표시하고, `virtual_products` 테이블에 `is_sample` 플래그가 없어 DB 직접 쿼리 시 구분 불가.
- **가격 소스가 yfinance 단독.** 한국 주식(KRX/KOSCOM) 실 데이터 소스 전환 계획 없음. 시장 장애 시 fallback 없음.
- **SQLite 단일 파일 백업 계획 없음.** 파일 삭제/손상 시 전체 트랙레코드 소실.
- **생존편향 방지 메커니즘은 우수** (DB 레벨 UPDATE/DELETE 트리거 + 수정주가 명시적 사용). 설계 원칙이 코드에 명문화되어 있다.

#### [시스템 3] ETF 상품개발 (Streamlit) — `C:\project\ETF 상품 개발 프로젝트`

- **백테스팅 결과가 메모리에만 존재, 영속 저장 없음.** `BacktestResult` 객체가 DB나 파일에 저장되지 않아 동일 파라미터 재실행 결과와 비교·검증 불가.
- **Look-Ahead Bias가 구조적으로 해결되지 않음.** 코드에 `look_ahead_bias_risk="MEDIUM"` 경고가 있으나, point-in-time DB 없이 yfinance `.info` 재무 데이터 사용 시 HIGH 수준의 미래 정보 오염 위험.
- **생존편향 경고만 있고 방지 미구현.** 현재 구성종목 기준 백테스팅으로 과거 상폐 종목 미포함, 성과 과대평가 가능.
- **Pickle 캐시 무결성 검증 없음.** `data_hub.pkl` 손상 시 예외 처리 없이 빈 데이터 반환.
- **`collected_at = datetime.now()`가 timezone-naive.** KST/UTC 혼재 환경에서 신선도 비교 오류 가능.
- **상당량의 수집 데이터(뉴스/소셜)가 로컬 캐시로 누적 중** (2026-06-01 ~ 2026-07-01). 수집 파이프라인은 정상 동작 중이나 데이터 품질 검증 로직 없음.

---

## 2. 리스크 등급 테이블

| # | 항목 | 시스템 | 리스크 | 근거 |
|---|------|--------|--------|------|
| 1 | Mock 가격이 운용 테이블에 혼입 | 운용시스템 | **높음** | V2__seed_prices.sql → latest_prices ON CONFLICT UPDATE |
| 2 | 시연 데이터 재현 불가 (SQLite DB 없음) | MH LAB | **높음** | data/ gitignore, mhlab.sqlite 미존재 |
| 3 | 보유 포지션 이력 복원 불가 | 운용시스템 | **높음** | holding_positions UPDATE-in-place, 이력 테이블 없음 |
| 4 | 백테스팅 결과 영속 저장 없음 | 상품개발 | **높음** | 재현·감사 불가 |
| 5 | Look-Ahead Bias 구조적 미해결 | 상품개발 | **높음** | point-in-time DB 부재, 현재 재무데이터 소급 사용 |
| 6 | 생존편향 방지 미구현 (백테스팅) | 상품개발 | **높음** | 상폐 종목 미포함, 수익률 과대평가 |
| 7 | Mock/실데이터 DB 레벨 구분 없음 | MH LAB | **중간** | virtual_products에 is_sample 컬럼 없음 |
| 8 | 가격 계보 컬럼 없음 (risk_metrics) | 운용시스템 | **중간** | calculated_at만 있고 source 없음 |
| 9 | NAV 수정주가 사용 여부 미기록 | 운용시스템 | **중간** | etf_navs 테이블 소스 컬럼 없음 |
| 10 | Pickle 무결성 검증 없음 | 상품개발 | **중간** | 손상 시 빈 데이터 silent return |
| 11 | SQLite 백업 계획 없음 | MH LAB | **중간** | 파일 손상 시 트랙레코드 전부 소실 |
| 12 | timezone-naive datetime | 상품개발 | **중간** | collected_at KST/UTC 혼재 가능 |
| 13 | yfinance 단독 소스, fallback 없음 | MH LAB | **중간** | 장애 시 평가 중단 |
| 14 | 개발 기본 비밀번호 yml 하드코딩 | 운용시스템 | **낮음** | 로컬 개발 환경, 운용 분리 필요 |
| 15 | 로그 보존 정책 없음 | 상품개발 | **낮음** | logs/ 파일 무기한 누적 |

---

## 3. 즉시 조치 필요 P0 목록

### P0-1. Mock 시드 데이터와 운용 DB 즉시 분리 (운용시스템)

**현황:** `V2__seed_prices.sql`이 `latest_prices` 테이블(실시간 조회 대상)에 `source='MOCK'` 가격을 INSERT. 현재 서비스 조회 시 Mock 가격이 반환될 수 있다.

**즉시 조치:**
1. 운용 DB에서 `source='MOCK'` 레코드를 별도 `test_prices` 테이블로 이전
2. 모든 서비스 쿼리에 `WHERE source != 'MOCK'` 조건 추가 또는 실데이터 수신 전까지 서비스 응답에 `data_quality: MOCK` 헤더 부착
3. Flyway Migration으로 격리 적용

**담당:** CTO (구현), CDO (기준 정의)

---

### P0-2. MH LAB ETF 시연 데이터 복원 및 DB 영속화 체계 수립

**현황:** `data/mhlab.sqlite` 파일이 존재하지 않는다. 2026-07-01 시연이 어떤 데이터로 수행되었는지 확인 불가.

**즉시 조치:**
1. 시연에 사용된 DB 파일 소재 확인 (로컬 사용자 폴더, 임시 경로 등)
2. 확인된 DB를 `data/mhlab_YYYYMMDD_snapshot.sqlite`로 보관
3. `data/.gitkeep` 방식으로 빈 폴더만 버전 관리하되, **실 DB는 별도 안전 경로에 정기 백업** 스크립트 추가
4. `virtual_products` 및 `nav_history`에 `is_sample BOOLEAN DEFAULT FALSE` 컬럼 추가하여 시드 데이터 구분

**담당:** CTO (구현), CDO (스냅샷 보관 기준)

---

### P0-3. 백테스팅 결과 영속 저장 및 재현 메타데이터 기록 (상품개발)

**현황:** `BacktestResult` 객체가 메모리에만 존재. 동일 아이디어를 다음 날 재실행해도 결과가 동일한지 보장 불가.

**즉시 조치:**
1. 백테스팅 실행 시 `data/outputs/{product_id}_{YYYYMMDD_HHMMSS}.json`으로 핵심 지표 저장
2. 저장 메타데이터: `run_at`, `tickers`, `weights`, `start_date`, `end_date`, `source=yfinance@{version}`, `look_ahead_bias_risk`, `survivor_bias_note`
3. 상품 개발 위원회 제출 전 백테스팅 결과 파일이 존재해야 하는 규정 신설 (절차 레벨)

**담당:** CTO (구현), CDO (저장 항목 기준)

---

### P0-4. 보유 포지션 이력 보존 (운용시스템)

**현황:** `holding_positions` 테이블이 UPDATE-in-place. 리밸런싱 직전 포지션 복원 불가.

**즉시 조치:**
1. `holding_positions_history` 테이블 추가 (현 스키마 + `snapped_at TIMESTAMPTZ`, `snapshot_reason TEXT`)
2. 리밸런싱 잡 실행 전 현재 포지션 스냅샷 INSERT
3. 또는 SCD Type 2 방식으로 `valid_from/valid_to` 컬럼으로 이력 관리 전환

**담당:** CTO (구현)

---

## 4. 데이터 품질 최소 기준 정의

전사 ETF 시스템 공통 적용. **위반 시 AI 학습·운용 입력 데이터로 사용 금지.**

### 기준 4-1. 저장 형태
| 항목 | 기준 |
|------|------|
| 영속성 | 운용 판단에 사용되는 데이터는 반드시 DB(관계형 또는 명시적 파일)에 저장. 메모리 전용 금지. |
| 스키마 버전 | 모든 DB 변경은 마이그레이션 스크립트로 관리 (Flyway/직접 DDL). ALTER 직접 실행 금지. |
| 타임스탬프 | UTC 또는 TIMESTAMPTZ 사용. timezone-naive datetime 금지. as_of 컬럼 필수. |

### 기준 4-2. 완전성
| 항목 | 기준 |
|------|------|
| NOT NULL | NAV, 가격, 포지션 수량, as_of 날짜는 NULL 금지 |
| 이력 보존 | 포지션·NAV·리밸런싱 데이터는 append-only 또는 이력 테이블 분리. 삭제·수정 금지. |
| Point-in-time | 과거 임의 시점의 포지션·NAV를 복원 가능해야 한다. |

### 기준 4-3. 정확성
| 항목 | 기준 |
|------|------|
| 수정주가 | 모든 NAV 계산·백테스팅에 수정종가(adjusted close) 사용. 원시 종가 사용 시 명시 기록. |
| 생존편향 | 백테스팅 결과에 생존편향 위험도(LOW/MEDIUM/HIGH) 필수 기재. 상폐 종목 처리 방식 명시. |
| Look-Ahead Bias | point-in-time DB 없이 펀더멘털 기반 종목 선정 시 결과에 HIGH 경고 필수 부착. |
| 수익률 복리 계산 | 비거래일(carry-forward)에 전일 수익률 복사 금지. 일간수익률 0으로 기록. |

### 기준 4-4. 계보
| 항목 | 기준 |
|------|------|
| 가격 소스 | 모든 가격 레코드에 `source` 컬럼 필수 (KOSCOM/KRX/yfinance/MOCK 등) |
| 갱신 시각 | 모든 데이터 레코드에 `created_at`(불변) + `source_as_of`(데이터 기준일) 구분 |
| 시스템 버전 | 백테스팅·NAV 계산 결과에 엔진 버전 또는 git commit hash 기록 |

### 기준 4-5. 오염 방지
| 항목 | 기준 |
|------|------|
| Mock 격리 | Mock/테스트 데이터는 운용 테이블과 물리적으로 분리 (`test_*` 스키마 또는 별도 DB) |
| 시드 데이터 | 개발용 시드는 운용 환경 마이그레이션에서 제외 (`V2__seed_*.sql` → dev 프로파일만 실행) |
| 샘플 플래그 | DB에 `is_sample BOOLEAN DEFAULT FALSE` 컬럼으로 시드/가상 데이터 명시 |

---

## 5. 데이터 카탈로그 초안

> 상세 버전: `C:\Users\Samsung\.openclaw\workspaces\cdo\docs\data-catalog.md`

### 5-1. ETF 운용시스템 (Spring / PostgreSQL)

| 데이터셋 | 정의 | 오너 | 갱신주기 | 신선도 SLA | 비고 |
|----------|------|------|----------|-----------|------|
| `stock_prices` | 종목별 시세 이력 (시각별 스냅샷) | CTO/market-data | 실시간 (3초) | 5분 이내 | source 컬럼 필수 검증 |
| `latest_prices` | 최신 시세 스냅샷 | CTO/market-data | 실시간 | 5분 이내 | Mock 데이터 분리 필요 (P0-1) |
| `etf_navs` | ETF NAV·iNAV 이력 | CTO/market-data | 30초 (iNAV), EOD (NAV) | EOD+1시간 | 수정주가 사용 여부 컬럼 추가 필요 |
| `etf_compositions` | ETF 구성종목 (MSCI 인덱스 포함) | CDO/운용팀 | 리밸런싱 시 | 리밸런싱일 T+1 | effective_from/to로 이력 관리 |
| `holding_positions` | 보유 포지션 | 운용팀 | 영업일 1회 | T+1 | 이력 테이블 분리 필요 (P0-4) |
| `rebalancing_jobs` | 리밸런싱 실행 이력 | 운용팀/CTO | 이벤트 발생 시 | 실행 즉시 | append-only 확인 필요 |
| `audit_events` | 감사 로그 (append-only) | CTO/감사팀 | 이벤트 발생 시 | 실시간 | PostgreSQL RULE로 보호 |
| `risk_metrics` | 추적오차·VaR·CVaR | CTO/리스크 | 영업일 1회 | T+1 오전 9시 | 계산 소스 컬럼 추가 필요 |
| `compliance_checks` | 위규관리 체크 (6항목) | 준법팀/CTO | 영업일 1회 | T 당일 |  |

### 5-2. MH LAB ETF (Python / SQLite)

| 데이터셋 | 정의 | 오너 | 갱신주기 | 신선도 SLA | 비고 |
|----------|------|------|----------|-----------|------|
| `virtual_products` | 가상 ETF 상품 정의 (append-only) | CDO/MH LAB | 신상품 등록 시 | 즉시 | is_sample 컬럼 추가 필요 |
| `nav_history` | 가상 ETF EOD NAV 이력 (append-only) | CDO/MH LAB | 영업일 EOD | T+1 오전 | eval_basis 컬럼으로 추적 가능 |
| `rebalance_policies` | 운용 정책 (버전드, append-only) | CDO | 정책 변경 시 | 즉시 |  |
| `rebalance_history` | 리밸런싱 실행 이력 (append-only) | CDO/MH LAB | 리밸런싱 실행 시 | 실행 즉시 |  |
| `data/prices/{ticker}.json` | 종목별 수정종가 캐시 | CTO/MH LAB | yfinance 조회 시 | 영업일 단위 | gitignore'd, 백업 필요 |

### 5-3. ETF 상품개발 (Streamlit / 파일 캐시)

| 데이터셋 | 정의 | 오너 | 갱신주기 | 신선도 SLA | 비고 |
|----------|------|------|----------|-----------|------|
| `data/cache/data_hub.pkl` | 뉴스·소셜·미디어 수집 결과 통합 | CDO/상품개발팀 | 1일 1회 (스케줄러) | 24시간 | 무결성 검증 없음, timezone-naive |
| `data/cache/krx_etf_list.json` | KRX ETF 전체 목록 | CDO/상품개발팀 | 1일 1회 | 24시간 | 최신 갱신: 2026-07-01 |
| `data/cache/issuer_flow_cache.pkl` | 운용사별 자금흐름 | CDO/상품개발팀 | 정기 | 24시간 | 최신: 2026-07-01 |
| 백테스팅 결과 | BacktestResult (in-memory) | CDO/상품개발팀 | 실행 시 | - | **영속 저장 없음 (P0-3)** |
| `data/outputs/{날짜}` | 보고서·분석 결과 | CDO/상품개발팀 | 실행 시 | - | 날짜별 폴더 누적 |

---

## 6. 쓰레기 데이터 방지 파이프라인 설계안

### 6-1. 3계층 방어 구조

```
[수집] → [검증 게이트] → [저장] → [모니터링]
```

#### Layer 1: 수집 단계 — 소스 메타데이터 부착

모든 데이터 레코드가 저장될 때 다음 4개 메타데이터를 필수 부착:

```
source:      KOSCOM | KRX | yfinance | MOCK | MANUAL
source_as_of: YYYY-MM-DD  (데이터의 기준일, 수집 시각과 별도)
ingested_at: TIMESTAMPTZ UTC (실제 수집/저장 시각)
is_sample:   BOOLEAN  (개발/테스트 데이터 여부)
```

#### Layer 2: 검증 게이트 — 저장 직전 품질 체크

| 체크 | 조건 | 처리 |
|------|------|------|
| NULL 검사 | 핵심 컬럼 NULL 금지 | 거부 + 에러 로그 |
| 범위 검사 | 가격 ≥ 0, 비중 합 = 1.0 ± 1e-6 | 거부 + 에러 로그 |
| 타임스탬프 검사 | timezone-aware 여부 | 거부 |
| Mock 격리 | is_sample=True → 운용 테이블 INSERT 차단 | 거부 + 경고 |
| 중복 검사 | (product_id, date) 중복 → 기존 데이터 우선 | 거부 (불변 원칙) |
| 신선도 검사 | source_as_of > 오늘 → 미래 데이터 거부 | 거부 |

#### Layer 3: 모니터링 — 이상 감지

매 영업일 자동 실행 체크리스트:

```
□ latest_prices에 source='MOCK' 레코드 존재 여부 알림
□ nav_history 최신 레코드의 as_of가 T-1 이상인지 확인
□ data_hub.pkl 신선도: collected_at이 24시간 이내인지 확인
□ mhlab.sqlite 파일 존재 및 접근 가능 여부
□ 백테스팅 실행 시 look_ahead_bias_risk=HIGH면 운용 회의 안건 미사용 경고
```

### 6-2. 환경 분리 원칙

```
운용 환경 (prod)
  ├─ PostgreSQL prod DB  ← Flyway V1 only (V2__seed 제외)
  ├─ Mock 데이터 접근 불가
  └─ is_sample=TRUE INSERT 차단 (트리거)

개발 환경 (local/dev)
  ├─ PostgreSQL dev DB  ← Flyway V1 + V2__seed
  ├─ Mock 데이터 허용
  └─ is_sample=TRUE 허용
```

Flyway 적용 시:
```yaml
# application-prod.yml
spring.flyway.locations: classpath:db/migration/prod  # V1만 포함
# application-dev.yml  
spring.flyway.locations: classpath:db/migration       # V1+V2(seed) 포함
```

### 6-3. 백테스팅 데이터 신뢰도 게이트

백테스팅 결과를 상품개발위원회에 제출하기 전 필수 통과 기준:

| 조건 | 기준값 | 미달 시 |
|------|--------|---------|
| 신뢰도 등급 | B 이상 (score ≥ 0.65) | 위원회 제출 전 데이터 보완 필수 |
| 기간 | 3년 이상 | 단기 분석으로 명시, 결과 헤더에 경고 |
| Look-Ahead Bias | MEDIUM 이하 | HIGH이면 "참고용" 워터마크 부착 |
| 생존편향 | 경고문 필수 부착 | 미부착 시 제출 불가 |
| 결과 저장 | 실행 ID + 타임스탬프 | 파일 저장 없으면 위원회 제출 불가 |

---

## 부록: 감사 방법론

- **감사 방법:** 소스코드·SQL 마이그레이션 직접 독해, 데이터 디렉토리 구조 확인
- **감사 대상 파일 수:** 약 40개 (SQL 16개, Python 주요 8개, YAML 5개, 기타)
- **코드 수정 없음:** 읽기 전용 감사
- **다음 감사:** 분기 1회 정기 감사 권고

---

*감사보고서 작성: CDO — 2026-07-02*
*승인: 인표님 (A/A)*
*구현 일정: CTO와 협의 필요*
