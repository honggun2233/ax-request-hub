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

// 전 직원 공통 (상단)
const NAV = [
  { href: '/', label: '홈' },
  { section: 'AI 지식' },
  { href: '/skills', label: '🔧 스킬 카탈로그' },
  { href: '/docs', label: '📄 거버넌스 문서' },
  { section: '나의 AI' },
  { href: '/me', label: '나의 현황' },
  { href: '/me/level', label: '레벨 신청' },
  { href: '/me/services', label: '내 서비스' },
  { href: '/me/usage', label: '사용량' },
  { href: '/me/literacy', label: '리터러시' },
  { section: '데이터' },
  { href: '/data/catalog', label: '📊 데이터 카탈로그' },
  { href: '/me/data', label: '내 데이터 신청' },
  { section: 'AI 과제' },
  { href: '/chat', label: '과제 신청' },
  { href: '/dashboard', label: '과제 현황' },
]

// Admin 전용
const ADMIN_NAV = [
  { section: '직원 · 계정 관리' },
  { href: '/admin/employees', label: '직원 관리' },
  { href: '/admin/distribution', label: '서비스 배분' },
  { href: '/admin/tools/quota-setup', label: '부서별 계정 배분' },
  { href: '/admin/tokens', label: '토큰 관리' },
  { href: '/admin/literacy', label: '리터러시 관리' },
  { section: '에이전트 관리' },
  { href: '/registry', label: '레지스트리 (라이프사이클)' },
  { href: '/admin/agents', label: '폐기 아카이브' },
  { section: '스킬 · 문서 관리' },
  { href: '/admin/skills', label: '스킬 등록/관리' },
  { href: '/admin/docs', label: '문서 메타데이터 관리' },
  { section: '감사 · 거버넌스' },
  { href: '/governance', label: '감사 로그' },
  { section: '경영진 뷰' },
  { href: '/executive', label: '경영진 AI 현황' },
]

// 데이터 플랫폼 전용
const DP_NAV = [
  { section: '데이터 플랫폼' },
  { href: '/dp/requests', label: '데이터 요청 검토' },
]

type NavItem = { href: string; label: string } | { section: string }

export default function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const role = (session?.user as any)?.role
  const isAdmin = ['AX_TEAM', 'C_LEVEL'].includes(role)
  const isDPAdmin = ['AX_TEAM', 'DATA_PLATFORM'].includes(role)
  const level = (session?.user as any)?.currentLevel ?? 'L0'

  const allNav: NavItem[] = [
    ...NAV,
    ...(isAdmin ? ADMIN_NAV : []),
    ...(isDPAdmin ? DP_NAV : []),
  ]

  return (
    <aside className="w-60 h-screen bg-white border-r flex flex-col fixed top-0 left-0 z-10 overflow-hidden">
      <div className="p-4 border-b">
        <h1 className="text-sm font-bold text-gray-900">삼성AM AI Hub</h1>
      </div>
      <nav className="flex-1 p-2 overflow-y-auto space-y-0.5">
        {allNav.map((item, i) => {
          if ('section' in item) {
            return <p key={i} className="text-xs text-gray-400 font-medium px-3 pt-4 pb-1 uppercase tracking-wide">{item.section}</p>
          }
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      {session && (
        <div className="p-3 border-t">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
              {session.user?.name?.[0] ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{session.user?.name}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LEVEL_BADGE[level]}`}>{level}</span>
            </div>
          </div>
          <button onClick={() => signOut()} className="w-full text-xs text-gray-500 hover:text-red-500 py-1">
            로그아웃
          </button>
        </div>
      )}
    </aside>
  )
}
