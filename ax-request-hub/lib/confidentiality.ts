/** 데이터 기밀등급 — G1/G2/G3는 내부 식별자, 표시는 공식 용어 사용 (데이터관리규정 v1.2 기준) */
export const CONF_LABEL: Record<string, string> = {
  G1: '공개정보',
  G2: '대외비',
  G3: '기밀(극비)',
}

export const CONF_COLOR: Record<string, string> = {
  G1: 'bg-green-100 text-green-800',
  G2: 'bg-yellow-100 text-yellow-800',
  G3: 'bg-red-100 text-red-800',
}

export const CONF_OPTIONS = [
  { value: 'G1', label: 'G1 — 공개정보' },
  { value: 'G2', label: 'G2 — 대외비' },
  { value: 'G3', label: 'G3 — 기밀(극비)' },
] as const
