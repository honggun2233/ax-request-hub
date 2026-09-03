/** 데이터 기밀등급 내부 코드 ↔ 표시명 매핑 (단일 소스)
 *  표시명 변경 시 이 파일만 수정할 것 — 코드 전체 grep 불필요
 *  근거: AI운영지침 v1.6 (G코드 폐지, 명칭만 사용)
 */
export const CONFIDENTIALITY_CODES = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'] as const
export type ConfidentialityCode = (typeof CONFIDENTIALITY_CODES)[number]

export const CONF_LABEL: Record<string, string> = {
  PUBLIC: '공개정보',
  RESTRICTED: '대외비',
  CONFIDENTIAL: '기밀(극비)',
}

export const CONF_COLOR: Record<string, string> = {
  PUBLIC: 'bg-green-100 text-green-800',
  RESTRICTED: 'bg-yellow-100 text-yellow-800',
  CONFIDENTIAL: 'bg-red-100 text-red-800',
}

export const CONF_OPTIONS = [
  { value: 'PUBLIC', label: '공개정보' },
  { value: 'RESTRICTED', label: '대외비' },
  { value: 'CONFIDENTIAL', label: '기밀(극비)' },
] as const
