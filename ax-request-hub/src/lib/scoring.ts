export interface ApprovalDecision {
  autoApproved: boolean
  reason: string
}

export function determineApproval(
  confidentialityLevel: 'G1' | 'G2' | 'G3',
  totalScore: number
): ApprovalDecision {
  if (confidentialityLevel === 'G3') {
    return {
      autoApproved: false,
      reason: 'G3 기밀 과제: 점수 무관 인표님 보고 필수',
    }
  }
  if (totalScore >= 70) {
    return {
      autoApproved: true,
      reason: `G1/G2 과제 자동 파일럿 승인 (${totalScore}점)`,
    }
  }
  if (totalScore >= 68) {
    return {
      autoApproved: false,
      reason: `경계값 (${totalScore}점): 근소 차이 검토 요청`,
    }
  }
  return {
    autoApproved: false,
    reason: `점수 미달 (${totalScore}점 < 70점): 인표님 보고`,
  }
}
