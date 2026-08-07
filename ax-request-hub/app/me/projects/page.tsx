"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

const SURFACE = '#FFFFFF'
const BG      = '#F7F9FC'
const LINE    = '#E4E9F2'
const BLUE    = '#4A6FA5'
const GOLD    = '#B8956A'
const NAVY    = '#1E3560'
const TEXT    = '#18243D'
const MUTED   = '#8898BB'
const DIM     = '#BEC8DC'

const STEPS = ['신청', '심사', '승인', '개발', '운영']

const STATUS_INFO: Record<string, { label: string; step: number; color: string }> = {
  submitted:  { label: '심사 중',     step: 1, color: '#D97706' },
  evaluated:  { label: '검토 완료',   step: 2, color: BLUE },
  pilot:      { label: '파일럿 승인', step: 3, color: '#059669' },
  production: { label: '운영 중',     step: 4, color: '#059669' },
  closed:     { label: '종료',        step: 0, color: MUTED },
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginTop: 12 }}>
      {STEPS.map((s, i) => {
        const done    = i < step
        const current = i === step
        return (
          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
              {i > 0 && <div style={{ flex: 1, height: 1, background: done ? 'rgba(184,149,106,.45)' : LINE }} />}
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: done ? GOLD : current ? 'rgba(184,149,106,.35)' : DIM,
                border: current ? `2px solid ${GOLD}` : 'none',
              }} />
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: done ? 'rgba(184,149,106,.45)' : LINE }} />}
            </div>
            <span style={{ fontSize: 9, color: done || current ? GOLD : MUTED, marginTop: 4, letterSpacing: '.04em' }}>{s}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function MyProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects?mine=1")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ color: TEXT, maxWidth: 720, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: NAVY, margin: 0 }}>내 AI 활용</h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>신청한 AI 활용의 진행 현황을 확인하세요.</p>
        </div>
        <Link href="/projects/new" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 600, color: '#ffffff',
          background: BLUE, border: `1px solid ${BLUE}`,
          padding: '7px 14px', borderRadius: 4, textDecoration: 'none',
        }}>
          <Plus size={14} /> AI 활용 신청
        </Link>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: MUTED, fontSize: 13 }}>불러오는 중…</div>
      )}

      {!loading && projects.length === 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 4, padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: 16 }}>아직 신청한 AI 활용이 없습니다.</p>
          <Link href="/projects/new" style={{ fontSize: 13, color: '#ffffff', background: BLUE, padding: '8px 16px', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>
            AI 활용 신청하기
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {projects.map((p) => {
          const info = STATUS_INFO[p.status] ?? { label: p.status, step: 0, color: MUTED }
          return (
            <Link key={p.id} href={`/status/${p.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 4, padding: '16px 20px', cursor: 'pointer', transition: 'border-color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74,111,165,.35)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = LINE)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, flex: 1, lineHeight: 1.4, margin: 0 }}>
                    {p.title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {p.pendingAppeal && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 2, color: GOLD, background: 'rgba(184,149,106,.12)', border: '1px solid rgba(184,149,106,.3)' }}>
                        이의제기
                      </span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 2, color: info.color, background: `${info.color}1A`, border: `1px solid ${info.color}4D` }}>
                      {info.label}
                    </span>
                  </div>
                </div>
                <ProgressBar step={info.step} />
                <p style={{ fontSize: 11, color: MUTED, marginTop: 10 }}>
                  신청일 {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                  {p.department && <span style={{ marginLeft: 10 }}>· {p.department}</span>}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  );
}
