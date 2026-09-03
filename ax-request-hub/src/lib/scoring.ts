export interface ApprovalDecision {
  autoApproved: boolean
  reason: string
}

// Gate 2: 기술 표준 준수 체크리스트 (AI-GUI-001 제10조 / AI-REG-003 제8조)
export interface TechStandardsChecklist {
  hasApiSpec: boolean            // API 스펙 문서(OpenAPI 등) 존재
  hasDataClassification: boolean  // 기밀등급 처리 방식 문서화
  hasAuditLogging: boolean       // 로깅·감사추적 구현
  hasTestCoverage: boolean       // 테스트 커버리지 기준 충족
  hasDataQualityCheck: boolean   // R-07: 데이터 무결성 검증 (AI-REG-003 제8조④)
  hasHumanInLoop: boolean        // R-09: Human-in-the-loop 검토 절차 (AI-REG-003 제8조⑤)
}

export function checkTechStandards(checklist: TechStandardsChecklist): {
  passed: boolean
  failedItems: string[]
} {
  const failedItems: string[] = []
  if (!checklist.hasApiSpec) failedItems.push('API 스펙 문서 미제출')
  if (!checklist.hasDataClassification) failedItems.push('데이터 기밀등급 처리 방식 미문서화')
  if (!checklist.hasAuditLogging) failedItems.push('로깅·감사추적 미구현')
  if (!checklist.hasTestCoverage) failedItems.push('테스트 커버리지 기준 미충족')
  if (!checklist.hasDataQualityCheck) failedItems.push('데이터 무결성 검증 미구현 (R-07)')
  if (!checklist.hasHumanInLoop) failedItems.push('Human-in-the-loop 검토 절차 미수립 (R-09)')
  return { passed: failedItems.length === 0, failedItems }
}

const AUTO_APPROVE_THRESHOLD = 70
const BORDERLINE_THRESHOLD = 68

export function determineApproval(
  confidentialityLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL',
  totalScore: number
): ApprovalDecision {
  if (confidentialityLevel === 'CONFIDENTIAL') {
    return {
      autoApproved: false,
      reason: 'G3 기밀(극비) AI 활용: 점수 무관 인표님 보고 필수',
    }
  }
  if (totalScore >= AUTO_APPROVE_THRESHOLD) {
    return {
      autoApproved: true,
      reason: `G1/G2 AI 활용 자동 파일럿 승인 (${totalScore}점)`,
    }
  }
  if (totalScore >= BORDERLINE_THRESHOLD) {
    return {
      autoApproved: false,
      reason: `경계값 (${totalScore}점): 근소 차이 검토 요청`,
    }
  }
  return {
    autoApproved: false,
    reason: `점수 미달 (${totalScore}점 < ${AUTO_APPROVE_THRESHOLD}점): 인표님 보고`,
  }
}
