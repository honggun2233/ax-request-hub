"use client"
import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Upload, FileText, Download, CheckCircle, AlertCircle, ChevronRight } from "lucide-react"

const SURFACE = '#0E0E0E'
const LINE    = '#1E1E1E'
const BLUE    = '#FF6600'
const TEXT    = '#E0E0E0'
const MUTED   = '#555555'
const DIM     = '#BEC8DC'
const BG      = '#000000'

const SAMPLE_CSV = `email,service,yearMonth,tokenUsed,costKrw
hong@example.com,CLAUDE_ENTERPRISE,2026-08,125000,12500
kim@example.com,GPT_CHAT,2026-08,80000,8000
lee@example.com,GEMINI,2026-08,60000,6000`

const SERVICES = [
  'CLAUDE_ENTERPRISE', 'GPT_CHAT', 'GPT_EXCEL', 'GEMINI', 'ONPREM_QWEN',
]

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'usage_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function UsageUploadPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'upsert' | 'append'>('upsert')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)

  if (status === 'loading') return <div style={{ padding: 40, color: MUTED }}>로딩 중…</div>
  if (status === 'unauthenticated') { router.push('/login'); return null }

  async function handleUpload() {
    if (!file) return
    setUploading(true); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mode', mode)
      const res = await fetch('/api/admin/usage/upload', { method: 'POST', body: fd })
      const json = await res.json()
      setResult({ ok: res.ok, ...json })
    } catch (e: any) {
      setResult({ ok: false, error: e.message })
    } finally {
      setUploading(false)
    }
  }

  const card: React.CSSProperties = {
    background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 0, padding: '20px 24px',
  }

  return (
    <div style={{ color: TEXT, background: BG, maxWidth: 720, margin: '0 auto', paddingBottom: 60 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: TEXT, margin: 0 }}>사용 현황 일괄 업로드</h1>
        <p style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>
          CSV 파일로 직원별 LLM 토큰 사용 현황을 일괄 등록합니다.
          기존 엑셀 방식을 대체합니다.
        </p>
      </div>

      {/* 가이드 */}
      <div style={{ ...card, marginBottom: 16, borderLeft: `3px solid ${BLUE}` }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: BLUE, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>
          CSV 형식 안내
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, margin: '0 0 6px' }}>필수 열</p>
            {['email — 직원 이메일', 'service — 서비스 코드', 'yearMonth — YYYY-MM', 'tokenUsed — 사용 토큰 수'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <ChevronRight size={11} style={{ color: BLUE }} />
                <span style={{ fontSize: 12, color: TEXT }}>{t}</span>
              </div>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, margin: '0 0 6px' }}>service 허용값</p>
            {SERVICES.map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 10, fontFamily: 'monospace', background: BG, border: `1px solid ${LINE}`, borderRadius: 3, padding: '1px 5px', color: BLUE }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={downloadSample} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: `1px solid ${LINE}`, borderRadius: 0,
          padding: '7px 14px', fontSize: 12, color: MUTED, cursor: 'pointer',
        }}>
          <Download size={13} /> 샘플 CSV 다운로드
        </button>
      </div>

      {/* 업로드 */}
      <div style={{ ...card, marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: BLUE, letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 14px' }}>
          파일 선택
        </p>

        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
          onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />

        <button onClick={() => fileRef.current?.click()} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: file ? 'rgba(74,111,165,.06)' : SURFACE,
          border: `1.5px dashed ${file ? BLUE : DIM}`,
          borderRadius: 0, padding: '28px 20px', cursor: 'pointer', width: '100%',
          marginBottom: 16,
        }}>
          {file ? (
            <div style={{ textAlign: 'center' }}>
              <FileText size={24} style={{ color: BLUE, marginBottom: 6 }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: BLUE, margin: 0 }}>{file.name}</p>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>클릭하면 파일을 바꿀 수 있습니다</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <Upload size={24} style={{ color: DIM, marginBottom: 6 }} />
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>CSV 파일을 선택하세요</p>
            </div>
          )}
        </button>

        {/* 등록 모드 */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            등록 방식
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { id: 'upsert', label: '덮어쓰기',  desc: '같은 직원·서비스·월이면 값을 교체' },
              { id: 'append', label: '합산 추가',  desc: '기존 값에 합산해서 누적' },
            ].map(opt => (
              <label key={opt.id} style={{ flex: 1, cursor: 'pointer' }}>
                <div style={{
                  border: `1.5px solid ${mode === opt.id ? BLUE : LINE}`,
                  background: mode === opt.id ? 'rgba(74,111,165,.06)' : SURFACE,
                  borderRadius: 0, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input type="radio" name="mode" value={opt.id} checked={mode === opt.id}
                      onChange={() => setMode(opt.id as any)} style={{ accentColor: BLUE }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: mode === opt.id ? BLUE : TEXT }}>{opt.label}</span>
                  </div>
                  <p style={{ fontSize: 11, color: DIM, margin: 0, paddingLeft: 20 }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button onClick={handleUpload} disabled={!file || uploading} style={{
          width: '100%', background: (file && !uploading) ? BLUE : LINE,
          border: 'none', borderRadius: 0, padding: '10px',
          fontSize: 13, fontWeight: 600,
          color: (file && !uploading) ? '#fff' : DIM,
          cursor: (file && !uploading) ? 'pointer' : 'not-allowed',
        }}>
          {uploading ? '업로드 중…' : '업로드 실행'}
        </button>
      </div>

      {/* 결과 */}
      {result && (
        <div style={{
          ...card,
          borderLeft: `3px solid ${result.ok ? '#00C864' : '#F87171'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {result.ok
              ? <CheckCircle size={16} style={{ color: '#00C864' }} />
              : <AlertCircle size={16} style={{ color: '#F87171' }} />}
            <span style={{ fontSize: 14, fontWeight: 700, color: result.ok ? '#00C864' : '#F87171' }}>
              {result.ok ? '업로드 완료' : '업로드 오류'}
            </span>
          </div>

          {result.ok && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: result.errors?.length ? 14 : 0 }}>
              {[
                { label: '전체 행', value: result.total },
                { label: '등록 성공', value: result.upserted },
                { label: '스킵 (오류)', value: result.skipped },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: BG, borderRadius: 0, padding: '10px 14px', textAlign: 'center' }}>
                  <p style={{ fontSize: 22, fontWeight: 700, color: TEXT, margin: 0 }}>{kpi.value}</p>
                  <p style={{ fontSize: 11, color: MUTED, margin: '3px 0 0' }}>{kpi.label}</p>
                </div>
              ))}
            </div>
          )}

          {!result.ok && result.error && (
            <p style={{ fontSize: 13, color: '#F87171', margin: 0 }}>{result.error}</p>
          )}

          {result.errors?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                행별 오류 ({result.errors.length}건)
              </p>
              <div style={{ background: BG, borderRadius: 0, padding: '10px 12px', maxHeight: 200, overflowY: 'auto' }}>
                {result.errors.map((e: string, i: number) => (
                  <p key={i} style={{ fontSize: 12, color: '#F87171', margin: '0 0 4px' }}>{e}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
