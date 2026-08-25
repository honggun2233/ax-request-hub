'use client'
import { useState } from 'react'

const ITEMS = [
  { key: 'techHasApiSpec',            label: 'API 명세서',          hint: 'OpenAPI / Swagger 또는 동등한 명세 존재' },
  { key: 'techHasDataClassification', label: '데이터 분류',          hint: '사용 데이터의 기밀등급 분류 완료' },
  { key: 'techHasAuditLogging',       label: '감사 로그',            hint: '입력 · 출력 · 오류 로그 기록 구조 존재' },
  { key: 'techHasTestCoverage',       label: '테스트 커버리지',      hint: '핵심 경로 70% 이상 커버' },
] as const

type TechKey = typeof ITEMS[number]['key']

interface Props {
  projectId: string
  initialValues: Record<TechKey, boolean | null>
  passed: boolean | null
  failedItems: string | null
}

export function Gate2Checklist({ projectId, initialValues, passed, failedItems }: Props) {
  const [vals, setVals] = useState<Record<TechKey, boolean>>(
    Object.fromEntries(ITEMS.map(i => [i.key, initialValues[i.key] ?? false])) as Record<TechKey, boolean>
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch(`/api/projects/${projectId}/gate2`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    } finally { setSaving(false) }
  }

  const failedList: string[] = failedItems ? JSON.parse(failedItems) : []
  const allPassed = ITEMS.every(i => vals[i.key])

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E4E9F2', borderRadius: 8, marginTop: 16, padding: '16px 18px', boxShadow: '0 1px 4px rgba(30,53,96,.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 3, height: 14, background: '#B8956A', borderRadius: 1, display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#8898BB', textTransform: 'uppercase' }}>
            Gate 2 — 기술 표준 체크리스트
          </span>
        </div>
        {passed !== null && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: passed ? 'rgba(5,150,105,.08)' : 'rgba(185,64,64,.08)',
            color: passed ? '#059669' : '#B94040',
            border: `1px solid ${passed ? 'rgba(5,150,105,.2)' : 'rgba(185,64,64,.2)'}`,
          }}>
            {passed ? '통과' : '미통과'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {ITEMS.map(item => {
          const checked = vals[item.key]
          const wasEvalFailed = failedList.includes(item.key)
          return (
            <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={checked}
                onChange={e => setVals(v => ({ ...v, [item.key]: e.target.checked }))}
                style={{ width: 14, height: 14, accentColor: '#4A6FA5', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, color: '#18243D', fontWeight: 500 }}>{item.label}</span>
                {wasEvalFailed && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: '#B94040', background: 'rgba(185,64,64,.08)', border: '1px solid rgba(185,64,64,.2)', padding: '1px 5px', borderRadius: 3 }}>
                    평가 미달
                  </span>
                )}
                <div style={{ fontSize: 11, color: '#8898BB', marginTop: 1 }}>{item.hint}</div>
              </div>
            </label>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={save} disabled={saving}
          style={{
            fontSize: 12, fontWeight: 600, padding: '6px 16px', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer',
            background: saving ? '#F3F4F6' : '#4A6FA5', color: saving ? '#9CA3AF' : '#FFFFFF', border: 'none',
          }}>
          {saving ? '저장 중…' : '저장'}
        </button>
        {allPassed && (
          <span style={{ fontSize: 11, color: '#059669' }}>✓ 4개 항목 모두 충족 — Gate3 채점 가능</span>
        )}
        {saved && <span style={{ fontSize: 11, color: '#059669' }}>저장됐습니다.</span>}
      </div>
    </div>
  )
}
