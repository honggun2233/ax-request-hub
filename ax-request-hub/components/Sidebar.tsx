'use client'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LEVEL_BADGE: Record<string, string> = {
  L0: 'bg-gray-100 text-gray-600',
  L1: 'bg-blue-100 text-blue-700',
  L2: 'bg-green-100 text-green-700',
  L3: 'bg-orange-100 text-orange-700',
  L4: 'bg-purple-100 text-purple-700',
}

type NavItem =
  | { kind: 'link'; href: string; label: string; icon?: string }
  | { kind: 'section'; label: string }
  | { kind: 'divider' }

// ─── 전 직원 공통 ──────────────────────────────────────────
const USER_NAV: NavItem[] = [
  { kind: 'section', label: 'AI 과제' },
  { kind: 'link', href: '/chat',      label: '과제 신청', icon: '✏️' },
  { kind: 'link', href: '/dashboard', label: '내 과제 현황', icon: '📋' },

  { kind: 'section', label: '나의 현황' },
  { kind: 'link', href: '/me',           label: '현황 요약' },
  { kind: 'link', href: '/me/tools',     label: 'AI 도구' },
  { kind: 'link', href: '/me/usage',     label: '사용량' },
  { kind: 'link', href: '/me/literacy',  label: '리터러시' },
  { kind: 'link', href: '/me/level',     label: '레벨 신청' },

  { kind: 'section', label: '데이터' },
  { kind: 'link', href: '/data/catalog', label: '카탈로그 검색', icon: '📊' },
  { kind: 'link', href: '/me/data',      label: '내 신청 내역' },

  { kind: 'section', label: '참고' },
  { kind: 'link', href: '/skills', label: '스킬 카탈로그', icon: '🔧' },
  { kind: 'link', href: '/docs',   label: '거버넌스 문서', icon: '📄' },
]

// ─── 부서장 추가 ────────────────────────────────────────────
const DEPT_HEAD_NAV: NavItem[] = [
  { kind: 'divider' },
  { kind: 'section', label: '팀 관리' },
  { kind: 'link', href: '/dept/tools', label: '팀 AI 도구 배분' },
]

// ─── AX팀 (관리자) ──────────────────────────────────────────
const ADMIN_NAV: NavItem[] = [
  { kind: 'divider' },
  { kind: 'section', label: '운영 현황' },
  { kind: 'link', href: '/admin',     label: '전체 대시보드', icon: '🏠' },
  { kind: 'link', href: '/executive', label: '경영진 뷰', icon: '📈' },
  { kind: 'link', href: '/council',   label: 'AI 위원회', icon: '⚖️' },

  { kind: 'section', label: '과제·에이전트' },
  { kind: 'link', href: '/registry',       label: '에이전트 레지스트리' },
  { kind: 'link', href: '/admin/retired',  label: '폐기 아카이브' },

  { kind: 'section', label: '직원·리터러시' },
  { kind: 'link', href: '/admin/employees', label: '직원 관리' },
  { kind: 'link', href: '/admin/literacy',  label: '리터러시 관리' },

  { kind: 'section', label: '도구·계정' },
  { kind: 'link', href: '/admin/distribution',       label: '서비스 배분' },
  { kind: 'link', href: '/admin/tools/quota-setup',  label: '부서 계정 할당' },
  { kind: 'link', href: '/admin/tokens',             label: '토큰 관리' },

  { kind: 'section', label: '데이터 관리' },
  { kind: 'link', href: '/dp/requests', label: '데이터 요청 검토' },
  { kind: 'link', href: '/dp/catalog',  label: 'DP 카탈로그' },

  { kind: 'section', label: '스킬·문서' },
  { kind: 'link', href: '/admin/skills', label: '스킬 관리' },
  { kind: 'link', href: '/admin/docs',   label: '문서 관리' },

  { kind: 'section', label: '거버넌스' },
  { kind: 'link', href: '/governance', label: '감사 로그' },
  { kind: 'link', href: '/graph',      label: '지식 그래프', icon: '🕸️' },
]

// ─── 데이터플랫폼팀 (AX팀 아닌 경우) ────────────────────────
const DP_NAV: NavItem[] = [
  { kind: 'divider' },
  { kind: 'section', label: '데이터 플랫폼' },
  { kind: 'link', href: '/dp/requests', label: '데이터 요청 검토' },
  { kind: 'link', href: '/dp/catalog',  label: 'DP 카탈로그' },
]

export default function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const role = (session?.user as any)?.role ?? ''
  const level = (session?.user as any)?.currentLevel ?? 'L0'

  const isAdmin = ['AX_TEAM', 'C_LEVEL'].includes(role)
  const isDeptHead = role === 'DEPT_HEAD'
  const isDPOnly = role === 'DATA_PLATFORM'

  const nav: NavItem[] = [
    ...USER_NAV,
    ...(isDeptHead ? DEPT_HEAD_NAV : []),
    ...(isAdmin ? ADMIN_NAV : []),
    ...(isDPOnly ? DP_NAV : []),
  ]

  return (
    <aside className="w-56 h-screen bg-white border-r flex flex-col fixed top-0 left-0 z-10 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b">
        <Link href="/" className="block">
          <h1 className="text-sm font-bold text-gray-900 leading-tight">삼성AM</h1>
          <p className="text-[11px] text-blue-600 font-medium">AI Hub</p>
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {nav.map((item, i) => {
          if (item.kind === 'divider') {
            return <div key={i} className="my-2 mx-3 border-t border-gray-100" />
          }
          if (item.kind === 'section') {
            return (
              <p key={i} className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider px-4 pt-4 pb-1">
                {item.label}
              </p>
            )
          }
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/') && item.href.split('/').length > 2)
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2 mx-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              {item.icon && <span className="text-xs w-4 text-center">{item.icon}</span>}
              <span className={item.icon ? '' : 'pl-5'}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* 사용자 정보 */}
      {session && (
        <div className="p-3 border-t bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
              {session.user?.name?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{session.user?.name}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${LEVEL_BADGE[level]}`}>{level}</span>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full text-[11px] text-gray-400 hover:text-red-500 py-0.5 transition-colors"
          >
            로그아웃
          </button>
        </div>
      )}
    </aside>
  )
}
