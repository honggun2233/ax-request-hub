import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SEED_SKILLS = [
  {
    skillId: 'skill-etf-nav-check',
    name: 'ETF NAV 이상 점검',
    category: 'ETF운용',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'RESTRICTED',
    status: 'active',
    purpose: 'ETF 순자산가치(NAV)와 시장가격 간 괴리를 발견하고 원인을 분석합니다. 운용역 및 리스크관리팀이 일일 점검 시 사용합니다.',
    instructions: '1. 해당 ETF의 NAV와 종가를 입력합니다.\n2. 프롬프트를 Claude에 붙여넣습니다.\n3. 괴리율이 ±2% 초과 시 운용팀에 즉시 보고합니다.',
    promptText: `당신은 ETF 운용 전문가입니다. 다음 ETF의 NAV 데이터를 분석하고 이상 여부를 판단해 주세요.

[입력 데이터]
- ETF명: {ETF명}
- 기준일: {YYYY-MM-DD}
- NAV (순자산가치): {NAV} 원
- 당일 종가: {종가} 원
- 추종지수 종가: {지수값}

[분석 항목]
1. NAV 괴리율 계산 및 평가 (정상/경고/이상)
2. 괴리 원인 추정 (유동성, 배당, 환율, 거래 오류 등)
3. 권고 조치 사항 (이상 시)

[출력 형식]
- 괴리율: X.XX%
- 판정: 정상/경고/이상
- 원인 추정: ...
- 조치 권고: ...`,
    examples: '입력: NAV 12,350원 / 종가 12,280원\n출력: 괴리율 -0.57% / 판정: 정상',
    cautions: 'G2 등급 내부 데이터 포함. 외부 공유 금지. 결과는 반드시 운용역이 검토 후 사용.',
  },
  {
    skillId: 'skill-report-summarize',
    name: '리서치 보고서 요약',
    category: '리서치',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: '증권사 리서치 보고서, 공시 문서, 뉴스를 빠르게 요약해 핵심 투자 포인트와 리스크를 추출합니다.',
    instructions: '1. 요약할 문서 내용을 복사합니다.\n2. 프롬프트에 [문서내용] 부분에 붙여넣습니다.\n3. Claude에 입력하여 결과를 받습니다.',
    promptText: `당신은 자산운용사의 리서치 애널리스트입니다. 아래 문서를 분석하여 투자 관점에서 핵심을 요약해 주세요.

[문서 내용]
{문서를 여기에 붙여넣기}

[요약 형식]
## 핵심 요약 (3줄 이내)
...

## 주요 투자 포인트
- 포인트 1
- 포인트 2

## 잠재 리스크
- 리스크 1
- 리스크 2

## 시장 영향 예상
...

## 액션 아이템 (있다면)
...`,
    examples: '',
    cautions: '요약 결과는 참고용이며 투자 결정의 단독 근거로 사용 금지.',
  },
  {
    skillId: 'skill-email-draft',
    name: '업무 메일 초안 작성',
    category: '업무자동화',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: '업무 상황을 간단히 입력하면 격식에 맞는 업무 메일 초안을 작성해 줍니다. 사내/외부 메일 모두 활용 가능합니다.',
    instructions: '1. 메일 목적, 수신자 관계, 전달할 내용을 간략히 입력합니다.\n2. 결과를 검토 후 수정하여 발송합니다.',
    promptText: `업무 메일 초안을 작성해 주세요.

[메일 정보]
- 수신자: {이름/직책} ({관계: 사내상사/외부기관/파트너사 등})
- 목적: {메일 목적}
- 전달 내용: {핵심 내용 요약}
- 첨부 파일: {있으면 명시, 없으면 없음}
- 톤: {정중하게/간결하게/친근하게}

아래 형식으로 작성해 주세요:
제목: ...
본문:
---
[인사]
[본론]
[마무리]
---`,
    examples: '목적: 미팅 일정 제안\n결과: 제목 "2026년 7월 업무 미팅 일정 제안 건" 형식 메일 초안',
    cautions: '고객 정보, 펀드 수익률 등 기밀 정보는 프롬프트에 입력하지 마세요.',
  },
  {
    skillId: 'skill-meeting-minutes',
    name: '회의록 작성',
    category: '업무자동화',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: '회의 메모나 녹취 텍스트를 구조화된 회의록으로 변환합니다. 결정사항과 액션아이템을 자동으로 추출합니다.',
    instructions: '1. 회의 중 메모하거나 STT 텍스트를 준비합니다.\n2. [회의 내용] 부분에 붙여넣습니다.\n3. 결과를 확인 후 내부 공유합니다.',
    promptText: `아래 회의 내용을 정리된 회의록으로 작성해 주세요.

[회의 기본 정보]
- 일시: {날짜 및 시간}
- 장소/방식: {장소 또는 온라인}
- 참석자: {참석자 이름 목록}
- 안건: {주요 안건}

[회의 내용]
{회의 내용을 여기에 붙여넣기}

[출력 형식]
# 회의록

## 회의 개요
- 일시:
- 참석자:
- 안건:

## 논의 내용
### 안건 1: ...
### 안건 2: ...

## 결정사항
1. ...

## 액션아이템
| 담당 | 내용 | 기한 |
|------|------|------|`,
    examples: '',
    cautions: '내부 논의 내용 포함. 외부 공유 시 민감 발언 삭제 후 배포.',
  },
  {
    skillId: 'skill-data-analysis',
    name: '데이터 분석 쿼리 생성',
    category: '데이터분석',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: 'SQL 또는 Python 데이터 분석 쿼리를 자연어로 요청하면 코드를 생성해 줍니다. Snowflake, PostgreSQL, pandas 지원.',
    instructions: '1. 분석하려는 데이터와 원하는 결과를 설명합니다.\n2. 사용 환경(DB 종류, 테이블명)을 함께 입력합니다.\n3. 생성된 코드를 검토 후 실행합니다.',
    promptText: `데이터 분석을 위한 코드를 작성해 주세요.

[환경]
- 플랫폼: {Snowflake SQL / PostgreSQL / Python pandas}
- 테이블/데이터: {테이블명 또는 데이터 설명}

[분석 목적]
{원하는 분석 내용을 자세히 설명}

[조건]
- 기간: {분석 기간}
- 필터: {적용할 필터 조건}
- 출력 형태: {집계 방식, 정렬 기준 등}

아래 형식으로 코드와 설명을 함께 제공해 주세요:
1. 코드
2. 주요 로직 설명
3. 주의사항 또는 인덱스 권고`,
    examples: '요청: 지난 3개월 ETF 일별 거래량 상위 10개\n결과: SELECT ... ORDER BY volume DESC LIMIT 10',
    cautions: 'G3 등급 데이터(개인정보, 미공개 수익률)는 입력하지 마세요. 코드 실행 전 DBA 검토 권장.',
  },
  // ── 업무자동화 ──────────────────────────────────────
  {
    skillId: 'skill-meeting-agenda',
    name: '회의 안건 정리 및 요약',
    category: '업무자동화',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: '회의 중 나온 발언과 결정사항을 구조화된 회의록으로 자동 정리합니다.',
    instructions: '1. 회의 중 메모한 내용을 복사합니다.\n2. 프롬프트에 붙여넣고 Claude에 전달합니다.\n3. 출력된 회의록을 검토 후 공유합니다.',
    promptText: `당신은 전문 회의록 작성자입니다. 아래 회의 메모를 바탕으로 공식 회의록을 작성해 주세요.

[회의 정보]
- 회의명: {회의명}
- 일시: {YYYY-MM-DD HH:MM}
- 참석자: {참석자 목록}

[회의 메모 원문]
{회의 중 작성한 메모를 여기에 붙여넣으세요}

[출력 형식]
1. 회의 목적 (1~2문장)
2. 주요 논의사항 (항목별)
3. 결정사항 (번호 목록)
4. 액션 아이템 (담당자 | 내용 | 기한)
5. 다음 회의 예정 (있는 경우)

개조식 문장으로 작성하고, 불명확한 내용은 "(확인 필요)"로 표시해 주세요.`,
    examples: '메모: "김팀장 - ETF 운용 자동화 Q4 목표, 이부장 동의, 10월까지 요건 정의"\n결과: 액션아이템 - 김팀장 | ETF 운용 자동화 요건 정의 | 2026-10-31',
    cautions: '개인 발언 내용이 포함될 경우 외부 AI 서비스 사용을 금지하고 내부 Claude Enterprise만 사용하세요.',
  },
  {
    skillId: 'skill-report-review',
    name: '보고서 초안 검토 및 개선',
    category: '업무자동화',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'RESTRICTED',
    status: 'active',
    purpose: '작성한 보고서 초안을 삼성자산운용 문서 기준에 맞게 검토하고 개선 제안을 제공합니다.',
    instructions: '1. 보고서 초안 전문을 복사합니다.\n2. 프롬프트에 초안을 붙여넣습니다.\n3. 제안 내용을 검토 후 최종 보고서에 반영합니다.',
    promptText: `당신은 삼성자산운용의 문서 작성 전문가입니다. 아래 보고서 초안을 검토하고 개선안을 제시해 주세요.

[검토 기준]
- 삼성 보고서 작성 기준 (개조식, 명사형 종결)
- 논리 구조 (배경 → 현황 → 문제점 → 해결방안 → 기대효과)
- 수치·근거 명확성
- 결재 라인 적합성

[보고서 초안]
{초안 내용을 여기 붙여넣으세요}

[출력]
1. 전체 평가 (A/B/C 등급 + 한줄 요약)
2. 항목별 개선 포인트 (최대 5개)
3. 수정이 필요한 문장 예시 → 수정 제안
4. 보완이 필요한 데이터·근거`,
    examples: '',
    cautions: '미확정 경영 정보, 인사 정보 등 기밀 내용은 내부망 Claude Enterprise에서만 사용하세요.',
  },
  {
    skillId: 'skill-email-response',
    name: '수신 메일 답장 초안 작성',
    category: '업무자동화',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: '수신된 업무 메일에 대한 적절한 답장 초안을 빠르게 작성합니다.',
    instructions: '1. 수신 메일 내용을 복사합니다.\n2. 원하는 응답 방향을 함께 입력합니다.\n3. 생성된 초안을 검토 후 발송합니다.',
    promptText: `다음 수신 메일에 대한 업무 답장을 작성해 주세요.

[수신 메일]
{수신 메일 내용}

[답장 방향]
{승인 / 거절 / 추가 확인 필요 / 일정 조율 등 원하는 방향을 입력}

[조건]
- 발신자: {내 이름·직책}
- 수신자 직급: {수신자 직급}
- 톤: {정중한 공식 / 친근한 팀 내 / 격식 있는 대외}

정중하고 명확한 표현을 사용하고, 불필요한 미사여구 없이 핵심만 전달해 주세요.`,
    examples: '',
    cautions: '개인정보나 계약 관련 민감 내용이 포함된 경우 내부 시스템만 사용하세요.',
  },
  // ── 리서치 ────────────────────────────────────────────
  {
    skillId: 'skill-market-trend',
    name: '시장 동향 분석 요약',
    category: '리서치',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: '수집한 시장 데이터·뉴스·리포트를 바탕으로 핵심 동향과 시사점을 정리합니다.',
    instructions: '1. 분석할 시장 자료(뉴스, 데이터, 리포트 등)를 수집합니다.\n2. 내용을 프롬프트에 붙여넣습니다.\n3. 출력된 요약을 팀 공유용으로 활용합니다.',
    promptText: `당신은 자산운용 시장 분석 전문가입니다. 아래 자료를 바탕으로 시장 동향 요약 리포트를 작성해 주세요.

[분석 대상]
- 시장/섹터: {예: 국내 ETF 시장, 채권 시장, 반도체 섹터}
- 기간: {분석 기간}

[참고 자료]
{뉴스, 데이터, 리포트 내용을 여기 붙여넣으세요}

[출력 형식]
1. 핵심 동향 요약 (3~5줄)
2. 주요 이슈 (최대 3개, 항목별 2~3줄)
3. 수치 요약 표 (지표 | 현재값 | 전월 대비)
4. 운용 시사점 (1~3개)
5. 모니터링 필요 항목`,
    examples: '',
    cautions: '미공개 내부 운용 전략이나 포트폴리오 정보는 포함하지 마세요.',
  },
  {
    skillId: 'skill-esg-analysis',
    name: 'ESG 투자 요인 분석',
    category: '리서치',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: '종목 또는 포트폴리오의 ESG 요인을 체계적으로 분석하고 투자 관점의 시사점을 도출합니다.',
    instructions: '1. 분석 대상 기업·ETF의 기본 정보를 준비합니다.\n2. 사용 가능한 ESG 공시 자료를 수집합니다.\n3. 프롬프트에 입력 후 결과를 검토합니다.',
    promptText: `당신은 ESG 투자 분석 전문가입니다. 아래 정보를 바탕으로 ESG 투자 분석 보고서를 작성해 주세요.

[분석 대상]
- 기업/ETF명: {종목명}
- 산업: {산업 분류}
- 분석 목적: {투자 검토 / 편입 검토 / 정기 모니터링}

[보유 자료]
{ESG 공시, 지속가능경영보고서, 뉴스 등을 여기 붙여넣으세요}

[분석 항목]
1. E (환경): 탄소중립, 에너지 사용, 환경 리스크
2. S (사회): 노동관행, 공급망, 지역사회 영향
3. G (지배구조): 이사회 구성, 주주권, 감사체계

[출력]
- 항목별 등급 (A/B/C) + 근거
- 주요 리스크 요인
- 투자 관점 종합 의견`,
    examples: '',
    cautions: '공개 자료만 사용하고, 내부 투자 결정 사항은 포함하지 마세요.',
  },
  // ── ETF 운용 추가 ─────────────────────────────────────
  {
    skillId: 'skill-etf-tracking-error',
    name: 'ETF 추적 오차 분석',
    category: 'ETF운용',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'RESTRICTED',
    status: 'active',
    purpose: 'ETF의 벤치마크 대비 추적 오차를 분석하고 원인을 파악합니다.',
    instructions: '1. ETF 일별 수익률 데이터와 벤치마크 수익률을 준비합니다.\n2. 최근 1개월 이상 데이터를 사용하세요.\n3. 추적 오차 허용 기준(0.3% 이내)과 비교합니다.',
    promptText: `당신은 ETF 운용 및 추적 오차 분석 전문가입니다.

[ETF 정보]
- ETF명: {ETF명}
- 추종 지수: {지수명}
- 분석 기간: {시작일} ~ {종료일}

[데이터]
날짜 | ETF 수익률 | 지수 수익률
{일별 데이터를 붙여넣으세요}

[분석 요청]
1. 일별/주별/월별 추적 오차 계산
2. 추적 오차 원인 분석 (비용, 리밸런싱, 배당, 유동성 등)
3. 허용 기준(0.3%) 초과 여부 및 기간
4. 개선 권고사항`,
    examples: '',
    cautions: '운용 전략 및 포트폴리오 구성 정보는 내부망에서만 처리하세요.',
  },
  // ── 데이터분석 추가 ───────────────────────────────────
  {
    skillId: 'skill-data-quality',
    name: '데이터 품질 점검',
    category: '데이터분석',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: '데이터셋의 결측치·이상값·중복·형식 오류를 자동으로 점검하고 정제 방안을 제시합니다.',
    instructions: '1. 점검할 데이터의 컬럼 목록과 샘플 데이터(10~20행)를 준비합니다.\n2. 주요 비즈니스 규칙(허용 범위, 필수값 등)을 정리합니다.\n3. 프롬프트에 입력하여 점검 결과를 받습니다.',
    promptText: `당신은 데이터 품질 전문가입니다. 아래 데이터셋의 품질을 점검하고 정제 방안을 제시해 주세요.

[데이터 설명]
- 테이블/파일명: {이름}
- 행 수: {총 행 수}
- 사용 목적: {이 데이터의 용도}

[컬럼 목록 및 샘플]
{컬럼명과 샘플 데이터 10~20행을 붙여넣으세요}

[비즈니스 규칙]
{알고 있는 유효성 규칙을 입력 (예: 수익률은 -50%~+50% 범위, 종목코드는 6자리 숫자)}

[출력]
1. 컬럼별 품질 현황 (결측률, 이상값 비율, 형식 오류)
2. 발견된 주요 문제 (TOP 5)
3. 정제 SQL/Python 코드 제안
4. 품질 개선 우선순위`,
    examples: '',
    cautions: '개인식별정보(이름, 이메일, 계좌번호)가 포함된 데이터는 마스킹 후 사용하세요.',
  },
  // ── 문서작성 추가 ─────────────────────────────────────
  {
    skillId: 'skill-regulation-draft',
    name: '내부 규정·지침 초안 작성',
    category: '문서작성',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'RESTRICTED',
    status: 'active',
    purpose: '삼성자산운용 내부 규정 양식에 맞는 규정·지침 초안을 생성합니다.',
    instructions: '1. 규정 제목과 핵심 내용(조항별 주요 내용)을 정리합니다.\n2. 프롬프트에 입력합니다.\n3. 출력된 초안을 컴플라이언스팀 검토 후 공식화합니다.',
    promptText: `당신은 삼성자산운용의 내부 규정 전문 작성자입니다. 아래 내용을 바탕으로 내부 규정 초안을 작성해 주세요.

[규정 기본 정보]
- 규정명: {규정명}
- 적용 대상: {적용 부서/인원}
- 시행 예정일: {날짜}
- 제정 배경: {왜 이 규정이 필요한지}

[포함할 주요 내용]
{조항별로 포함할 내용을 설명해 주세요}

[출력 형식]
제1조 (목적)
제2조 (적용 범위)
제3조 (용어 정의)
제4조 이하 (본문 조항들)
부칙

삼성 보고서 기준(개조식, 명사형 종결)을 따르고, 각 조항은 간결하게 작성하세요.`,
    examples: '',
    cautions: '작성된 초안은 반드시 컴플라이언스팀과 법무 검토를 거쳐야 합니다. 확정된 규정으로 오인하지 마세요.',
  },
  // ── 기타 ──────────────────────────────────────────────
  {
    skillId: 'skill-code-review',
    name: '코드 리뷰 및 개선 제안',
    category: '기타',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: 'Python·SQL·TypeScript 코드의 버그, 성능, 가독성, 보안 취약점을 리뷰합니다.',
    instructions: '1. 리뷰받을 코드를 복사합니다.\n2. 코드 목적과 실행 환경을 함께 입력합니다.\n3. 제안된 개선사항을 검토 후 반영합니다.',
    promptText: `당신은 숙련된 시니어 개발자입니다. 아래 코드를 리뷰하고 개선 제안을 해주세요.

[코드 정보]
- 언어: {Python / SQL / TypeScript / 기타}
- 목적: {이 코드가 하는 일}
- 실행 환경: {Snowflake / PostgreSQL / Node.js / Python 3.x 등}

[코드]
\`\`\`
{코드를 여기 붙여넣으세요}
\`\`\`

[리뷰 항목]
1. 버그 및 로직 오류
2. 성능 개선 포인트
3. 가독성·유지보수성
4. 보안 취약점 (SQL Injection, 민감정보 노출 등)
5. 수정된 코드 제안

심각도(High/Medium/Low)를 표시하고 수정 예시 코드를 포함해 주세요.`,
    examples: '',
    cautions: '내부 시스템 접속 정보, API 키, 패스워드 등이 포함된 코드는 반드시 제거 후 사용하세요.',
  },
  {
    skillId: 'skill-ppt-outline',
    name: '발표 자료 목차 및 스토리라인 설계',
    category: '기타',
    author: 'AX팀',
    version: '1.0.0',
    securityLevel: 'PUBLIC',
    status: 'active',
    purpose: '보고·발표 목적에 맞는 슬라이드 목차와 스토리라인을 설계합니다.',
    instructions: '1. 발표 목적, 청중, 시간을 입력합니다.\n2. 전달하고 싶은 핵심 메시지를 정리합니다.\n3. 출력된 목차와 각 슬라이드 설명을 바탕으로 자료를 제작합니다.',
    promptText: `당신은 McKinsey 수준의 경영 프레젠테이션 전문가입니다. 아래 조건으로 발표 자료 구성안을 설계해 주세요.

[발표 정보]
- 제목: {발표 제목}
- 목적: {의사결정 요청 / 현황 보고 / 제안 / 교육}
- 청중: {임원진 / 팀장급 / 전 직원 / 외부 파트너}
- 발표 시간: {분}
- 슬라이드 수 목표: {장}

[핵심 메시지]
{전달하고 싶은 핵심 내용 3~5가지}

[출력]
1. 전체 스토리라인 (1~2문장)
2. 슬라이드별 구성 (번호 | 제목 | 내용 요약 | 시각화 제안)
3. 각 슬라이드의 핵심 메시지 1줄
4. 특히 강조해야 할 슬라이드와 이유`,
    examples: '',
    cautions: '미공개 경영 정보가 포함될 경우 내부망 Claude Enterprise만 사용하세요.',
  },
]

// POST /api/skills/seed  — 초기 스킬 시드 (AX_TEAM admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'AX_TEAM') {
    return NextResponse.json({ error: 'AX팀 전용 기능입니다.' }, { status: 403 })
  }
  try {
    const results = []
    for (const s of SEED_SKILLS) {
      const skill = await prisma.skill.upsert({
        where: { skillId: s.skillId },
        create: {
          ...s,
          approvedBy: 'AX팀',
          approvedAt: s.status === 'active' ? new Date() : null,
          targetUsers: '[]',
          usageCount: 0,
        },
        update: {
          name: s.name,
          purpose: s.purpose,
          promptText: s.promptText,
          status: s.status,
          approvedAt: s.status === 'active' ? new Date() : null,
        },
      })
      results.push(skill.skillId)
    }
    return NextResponse.json({ seeded: results.length, skills: results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
