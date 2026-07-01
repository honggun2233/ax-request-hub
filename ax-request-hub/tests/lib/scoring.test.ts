import { determineApproval, ApprovalDecision } from '@/src/lib/scoring'

describe('determineApproval', () => {
  test('G3 과제는 점수 무관 항상 인표님 보고', () => {
    const result = determineApproval('G3', 90)
    expect(result.autoApproved).toBe(false)
    expect(result.reason).toContain('G3')
  })

  test('G1 + 70점 이상 → 자동 승인', () => {
    const result = determineApproval('G1', 75)
    expect(result.autoApproved).toBe(true)
  })

  test('G2 + 70점 이상 → 자동 승인', () => {
    const result = determineApproval('G2', 70)
    expect(result.autoApproved).toBe(true)
  })

  test('G1 + 68~69점 → 경계값 보고 (자동 승인 X)', () => {
    const result = determineApproval('G1', 68)
    expect(result.autoApproved).toBe(false)
    expect(result.reason).toContain('경계')
  })

  test('G1 + 67점 이하 → 인표님 보고', () => {
    const result = determineApproval('G1', 67)
    expect(result.autoApproved).toBe(false)
  })
})
