import { NextRequest, NextResponse } from 'next/server'
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
]

// POST /api/skills/seed  — 초기 스킬 시드 (AX_TEAM admin only)
export async function POST(req: NextRequest) {
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
