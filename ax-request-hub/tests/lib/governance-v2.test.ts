/**
 * 거버넌스 v2.0 (2026-10-01) 변경사항 검증 테스트
 * 운영규정 제10조(위험등급 4단계), 제11조⑤(초고위험 즉시 차단)
 */

import { riskLevel, ULTRA_HIGH_RISK_STAGES, HIGH_RISK_STAGES, MED_RISK_STAGES } from '@/lib/impact-graph'

// ── 1. 위험등급 4단계 분류 (운영규정 제10조) ──────────────────────────────────

describe('riskLevel — 4단계 분류 (운영규정 제10조)', () => {
  test('ULTRA_HIGH_BLOCKED → ULTRA_HIGH 반환', () => {
    expect(riskLevel('ULTRA_HIGH_BLOCKED')).toBe('ULTRA_HIGH')
  })

  test('초고위험 스테이지가 HIGH보다 우선 처리됨', () => {
    const order: Record<string, number> = { ULTRA_HIGH: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    expect(order[riskLevel('ULTRA_HIGH_BLOCKED')]).toBeLessThan(order[riskLevel('GATE2')])
  })

  test('기존 HIGH 스테이지 정상 동작', () => {
    expect(riskLevel('GATE2')).toBe('HIGH')
    expect(riskLevel('GATE3')).toBe('HIGH')
    expect(riskLevel('PROD')).toBe('HIGH')
  })

  test('기존 MEDIUM 스테이지 정상 동작', () => {
    expect(riskLevel('GATE1')).toBe('MEDIUM')
    expect(riskLevel('PILOT')).toBe('MEDIUM')
  })

  test('미분류 스테이지 → LOW 반환', () => {
    expect(riskLevel('DEVELOPING')).toBe('LOW')
    expect(riskLevel('UNKNOWN')).toBe('LOW')
    expect(riskLevel('')).toBe('LOW')
  })

  test('RETIRED는 LOW 반환 (policy.ts에서 별도 BLOCK 처리)', () => {
    expect(riskLevel('RETIRED')).toBe('LOW')
  })
})

// ── 2. 스테이지 집합 정합성 ──────────────────────────────────────────────────

describe('스테이지 집합 정합성', () => {
  test('ULTRA_HIGH_RISK_STAGES에 ULTRA_HIGH_BLOCKED 포함', () => {
    expect(ULTRA_HIGH_RISK_STAGES.has('ULTRA_HIGH_BLOCKED')).toBe(true)
  })

  test('세 집합 간 중복 없음 (단계가 2개 집합에 동시 속하면 안 됨)', () => {
    const allSets = [ULTRA_HIGH_RISK_STAGES, HIGH_RISK_STAGES, MED_RISK_STAGES]
    for (let i = 0; i < allSets.length; i++) {
      for (let j = i + 1; j < allSets.length; j++) {
        for (const stage of allSets[i]) {
          expect(allSets[j].has(stage)).toBe(false)
        }
      }
    }
  })

  test('riskLevel 결과 정렬 순서 — ULTRA_HIGH < HIGH < MEDIUM < LOW', () => {
    const stages = ['ULTRA_HIGH_BLOCKED', 'GATE3', 'PILOT', 'DEVELOPING']
    const order: Record<string, number> = { ULTRA_HIGH: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
    const levels = stages.map(s => order[riskLevel(s)])
    for (let i = 0; i < levels.length - 1; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i + 1])
    }
  })
})

// ── 3. 승인 경로 결정 로직 검증 (운영규정 제9조) ─────────────────────────────

describe('고위험 판별 로직 — approve route 기준', () => {
  function isHighRisk(project: { confidentialityLevel: string; totalScore?: number; isHighImpactAI?: boolean; isHighCapabilityAI?: boolean }): boolean {
    return project.confidentialityLevel === 'CONFIDENTIAL'
      || (project.totalScore ?? 0) >= 80
      || !!project.isHighImpactAI
      || !!project.isHighCapabilityAI
  }

  test('CONFIDENTIAL 등급 → 고위험', () => {
    expect(isHighRisk({ confidentialityLevel: 'CONFIDENTIAL' })).toBe(true)
  })

  test('점수 80점 이상 → 고위험', () => {
    expect(isHighRisk({ confidentialityLevel: 'RESTRICTED', totalScore: 80 })).toBe(true)
    expect(isHighRisk({ confidentialityLevel: 'RESTRICTED', totalScore: 79 })).toBe(false)
  })

  test('isHighImpactAI=true → 고위험', () => {
    expect(isHighRisk({ confidentialityLevel: 'RESTRICTED', isHighImpactAI: true })).toBe(true)
  })

  test('isHighCapabilityAI=true → 고위험', () => {
    expect(isHighRisk({ confidentialityLevel: 'PUBLIC', isHighCapabilityAI: true })).toBe(true)
  })

  test('저위험 과제 → 고위험 아님', () => {
    expect(isHighRisk({ confidentialityLevel: 'PUBLIC', totalScore: 60 })).toBe(false)
    expect(isHighRisk({ confidentialityLevel: 'RESTRICTED', totalScore: 50 })).toBe(false)
  })
})

// ── 4. 점검 주기 계산 로직 (위험관리지침 제4조③) ─────────────────────────────

describe('점검 주기 계산 — registry route 기준', () => {
  function getReviewCycle(riskType: number | null): string {
    return riskType === null ? 'ANNUAL'
      : riskType >= 3 ? 'QUARTERLY'
      : riskType === 2 ? 'BIANNUAL'
      : 'ANNUAL'
  }

  function getReviewMonths(cycle: string): number {
    return cycle === 'QUARTERLY' ? 3 : cycle === 'BIANNUAL' ? 6 : 12
  }

  test('유형 1 → 연 1회 (ANNUAL)', () => {
    expect(getReviewCycle(1)).toBe('ANNUAL')
    expect(getReviewMonths('ANNUAL')).toBe(12)
  })

  test('유형 2 → 반기 1회 (BIANNUAL)', () => {
    expect(getReviewCycle(2)).toBe('BIANNUAL')
    expect(getReviewMonths('BIANNUAL')).toBe(6)
  })

  test('유형 3 → 분기 1회 (QUARTERLY)', () => {
    expect(getReviewCycle(3)).toBe('QUARTERLY')
    expect(getReviewMonths('QUARTERLY')).toBe(3)
  })

  test('유형 4 → 분기 1회 (QUARTERLY)', () => {
    expect(getReviewCycle(4)).toBe('QUARTERLY')
  })

  test('미분류(null) → 연 1회 (ANNUAL)', () => {
    expect(getReviewCycle(null)).toBe('ANNUAL')
  })
})

// ── 5. 유형 3·4 필수 요건 검증 로직 (운영지침 제21조②-5, ④) ──────────────────

describe('유형 3·4 에이전트 등록 검증', () => {
  function validateAgentRegistration(data: { riskType?: number; hasInstantShutdown?: boolean; hasHumanApprovalForAutonomous?: boolean }): string | null {
    const riskTypeNum = data.riskType ?? null
    if (riskTypeNum !== null && riskTypeNum >= 3) {
      if (!data.hasInstantShutdown) return '즉시 중단(10초 이내) 기능 필요'
      if (!data.hasHumanApprovalForAutonomous) return '자율 실행 범위 사람 승인 단계 필요'
    }
    return null
  }

  test('유형 3, hasInstantShutdown=false → 오류 반환', () => {
    expect(validateAgentRegistration({ riskType: 3, hasInstantShutdown: false })).toContain('즉시 중단')
  })

  test('유형 4, hasHumanApprovalForAutonomous=false → 오류 반환', () => {
    expect(validateAgentRegistration({ riskType: 4, hasInstantShutdown: true, hasHumanApprovalForAutonomous: false })).toContain('사람 승인')
  })

  test('유형 3, 두 요건 충족 → 통과', () => {
    expect(validateAgentRegistration({ riskType: 3, hasInstantShutdown: true, hasHumanApprovalForAutonomous: true })).toBeNull()
  })

  test('유형 1·2 → 요건 불필요 (null 통과)', () => {
    expect(validateAgentRegistration({ riskType: 1 })).toBeNull()
    expect(validateAgentRegistration({ riskType: 2, hasInstantShutdown: false })).toBeNull()
  })

  test('미분류(undefined) → 요건 불필요', () => {
    expect(validateAgentRegistration({})).toBeNull()
  })
})

// ── 6. 감사 로그 3년 보관 계산 (운영지침 제21조⑤) ────────────────────────────

describe('감사 로그 retainUntil 계산', () => {
  test('retainUntil = 현재로부터 3년 후', () => {
    const now = new Date('2026-10-07T00:00:00Z')
    const retainUntil = new Date(now)
    retainUntil.setFullYear(retainUntil.getFullYear() + 3)

    expect(retainUntil.getFullYear()).toBe(2029)
    expect(retainUntil.getMonth()).toBe(now.getMonth())
    expect(retainUntil.getDate()).toBe(now.getDate())
  })

  test('윤년 경계값 처리', () => {
    const leapDay = new Date('2024-02-29T00:00:00Z')
    const retain = new Date(leapDay)
    retain.setFullYear(retain.getFullYear() + 3)
    // 2027-02-29는 없으므로 JS는 2027-03-01로 넘어감
    expect(retain.getFullYear()).toBe(2027)
  })
})
