/**
 * 상태 라벨 이중화 — 내부 코드(devStage/prodStatus)는 관리자 화면에만,
 * 직원 화면에는 쉬운 라벨 + 진행 단계를 노출한다.
 */

export const EMPLOYEE_STEPS = ["접수됨", "검토 중", "승인", "개발 중", "시범 운영", "정식 운영"] as const;

export type Tone = "default" | "info" | "success" | "warning" | "danger";
type StageInfo = { label: string; step: number; tone: Tone };

export const DEV_STAGE_LABELS: Record<string, StageInfo> = {
  SUBMITTED:       { label: "접수됨",               step: 0, tone: "default" },
  EVALUATED:       { label: "검토 중",              step: 1, tone: "info" },
  GATE1:           { label: "승인 — 준비 단계",      step: 2, tone: "info" },
  GATE2:           { label: "개발 중",              step: 3, tone: "info" },
  GATE3:           { label: "개발 완료 — 검증 중",   step: 3, tone: "info" },
  PILOT_PROVEN:    { label: "시범 운영 중",          step: 4, tone: "info" },
  COUNCIL_PENDING: { label: "정식 운영 심의 중",     step: 4, tone: "warning" },
  COND_APPROVED:   { label: "조건부 승인 — 이행 중", step: 4, tone: "warning" },
  DEV_REJECTED:    { label: "반려됨",               step: 1, tone: "danger" },
};

export const PROD_STATUS_LABELS: Record<string, StageInfo> = {
  ACTIVE:     { label: "정식 운영 중", step: 5, tone: "success" },
  SUSPENDED:  { label: "일시 중단",    step: 5, tone: "warning" },
  DEPRECATED: { label: "종료 예정",    step: 5, tone: "warning" },
  RETIRED:    { label: "운영 종료",    step: 5, tone: "default" },
};

export const PROJECT_STATUS_LABELS: Record<string, StageInfo> = {
  submitted: { label: "접수됨",    step: 0, tone: "default" },
  evaluated: { label: "검토 중",   step: 1, tone: "info" },
  approved:  { label: "승인됨",    step: 2, tone: "success" },
  rejected:  { label: "반려됨",    step: 1, tone: "danger" },
  pilot:     { label: "개발 진행", step: 3, tone: "info" },
};

export const DATA_REQUEST_LABELS: Record<string, string> = {
  REQUESTED: "신청 접수", REVIEWING: "검토 중", SEC_REVIEW: "정보보호 협의 중",
  APPROVED: "승인 — 준비 중", COLLECTING: "데이터 적재 중", REJECTED: "반려됨",
  PROVISIONED: "제공 완료", EXPIRED: "이용기간 만료", REVOKED: "제공 회수됨",
};

export const COUNCIL_DECISION_LABELS: Record<string, string> = {
  APPROVED: "승인", CONDITIONAL: "조건부 승인", REMANDED: "반려 (재상정 가능)",
  REJECTED: "최종 반려", DEFERRED: "보류 (차기 이월)",
};

export const AGENDA_TYPE_LABELS: Record<string, string> = {
  PROD_APPROVAL: "상용 전환 승인", RETIRE_APPROVAL: "폐기 승인",
  MAJOR_CHANGE: "주요 변경", PILOT_EXTENSION: "파일럿 연장", EMERGENCY: "긴급 안건",
};

export function friendlyAgentStatus(phase: string, devStage?: string | null, prodStatus?: string | null): StageInfo {
  if (phase === "PRODUCTION" && prodStatus)
    return PROD_STATUS_LABELS[prodStatus] ?? { label: prodStatus, step: 5, tone: "default" };
  if (phase === "CLOSED") return { label: "종료", step: 5, tone: "default" };
  if (devStage) return DEV_STAGE_LABELS[devStage] ?? { label: devStage, step: 2, tone: "default" };
  return { label: "확인 중", step: 0, tone: "default" };
}
