"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Home, Plus, ListChecks, Database, FileText, Star, Book,
  User, Wrench, Users, BarChart3, Cpu, Gavel, Coins,
  Shield, LogOut, LayoutDashboard, Network, Scale,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/authz";

const LEVEL_BADGE: Record<string, string> = {
  L0: "bg-gray-100 text-gray-600",
  L1: "bg-blue-100 text-blue-700",
  L2: "bg-green-100 text-green-700",
  L3: "bg-orange-100 text-orange-700",
  L4: "bg-purple-100 text-purple-700",
};

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = {
  title?: string;
  items: NavItem[];
  /** 표시 대상 역할. 미지정 = 전체 */
  roles?: Role[];
  /** 관리자 구역 구분선 앞에 표시 */
  adminDivider?: boolean;
};

const NAV: NavGroup[] = [
  // ─── 전 직원 공통 ──────────────────────────────────────
  {
    items: [{ href: "/", label: "홈", icon: Home }],
  },
  {
    title: "AI 활용",
    items: [
      { href: "/projects/new", label: "AI 활용 신청",  icon: Plus },
      { href: "/me/projects",  label: "내 신청 현황",  icon: ListChecks },
      { href: "/me/tools",     label: "내 도구",       icon: Wrench },
      { href: "/data/catalog", label: "데이터 신청",   icon: Database },
    ],
  },
  {
    title: "내 정보",
    items: [
      { href: "/me",      label: "프로필 · 교육", icon: User },
      { href: "/me/data", label: "내 데이터 신청", icon: FileText },
      { href: "/docs",    label: "규정 · 문서",   icon: Book },
    ],
  },

  // ─── 부서장 ────────────────────────────────────────────
  {
    title: "팀 관리",
    roles: ["DEPT_HEAD"],
    adminDivider: true,
    items: [
      { href: "/dept/tools", label: "도구 배정", icon: Users },
    ],
  },

  // ─── 경영진 ────────────────────────────────────────────
  {
    title: "경영 현황",
    roles: ["EXECUTIVE", "C_LEVEL"],
    adminDivider: true,
    items: [
      { href: "/executive", label: "경영 대시보드", icon: BarChart3 },
    ],
  },

  // ─── 데이터플랫폼팀 ────────────────────────────────────
  {
    title: "데이터 운영",
    roles: ["DATA_PLATFORM"],
    adminDivider: true,
    items: [
      { href: "/dp/requests", label: "데이터 승인", icon: FileText },
    ],
  },

  // ─── AX팀 : 3기둥으로 압축 ─────────────────────────────
  // 기둥2·3 — 에이전트 개발 지원 → 관리 (폐기 거버넌스는 에이전트 현황 헤더로 진입)
  {
    title: "AI 파이프라인",
    roles: ["AX_TEAM"],
    adminDivider: true,
    items: [
      { href: "/dashboard", label: "활용 현황",    icon: BarChart3 },
      { href: "/registry",  label: "에이전트 현황", icon: Cpu },
      { href: "/council",   label: "AI 위원회",    icon: Gavel },
    ],
  },
  // 운영 관리 — 심사·승인·인력·비용 (직원·교육은 서브탭으로 통합)
  {
    title: "운영 관리",
    roles: ["AX_TEAM"],
    items: [
      { href: "/admin",           label: "심사 관리",   icon: LayoutDashboard },
      { href: "/dp/requests",     label: "데이터 승인", icon: Database },
      { href: "/admin/appeals",   label: "이의제기",    icon: Scale },
      { href: "/admin/employees", label: "직원 · 교육", icon: Users },
      { href: "/admin/tokens",    label: "토큰 · 쿼터", icon: Coins },
      { href: "/dept/tools",      label: "도구 배정",   icon: Wrench },
    ],
  },
  // 기둥1 지원 + 거버넌스 — 규정·감사·자산
  {
    title: "거버넌스",
    roles: ["AX_TEAM"],
    items: [
      { href: "/admin/docs",   label: "규정 · 지침",  icon: Book },
      { href: "/governance",   label: "감사 로그",    icon: Shield },
      { href: "/admin/skills", label: "스킬 관리",    icon: Star },
      { href: "/graph",        label: "지식 그래프",  icon: Network },
    ],
  },
];

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const level = (session?.user as any)?.currentLevel ?? "L0";

  // 역할에 맞는 그룹만 표시
  const visible = NAV.filter((g) => !g.roles || g.roles.includes(role));
  const hasAdminSection = visible.some((g) => g.adminDivider);

  // 가장 긴 prefix가 일치하는 항목만 active — 짧은 prefix가 중복 활성화되는 현상 방지
  const allItems = NAV.flatMap((g) => g.items);
  const activeHref = allItems
    .filter((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="flex h-full w-[248px] flex-col bg-[#0F172A] border-r border-[#1E293B]">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="w-7 h-7 rounded-md bg-[#C8A84B] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" />
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <p className="text-[11px] text-white/50 font-medium leading-none">삼성자산운용</p>
            <p className="text-[13px] text-white font-semibold leading-tight mt-0.5">AX Request Hub</p>
          </div>
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {visible.map((group, gi) => {
          const showDivider = group.adminDivider;
          return (
            <div key={gi}>
              {showDivider && (
                <div className="mx-1 my-3 border-t border-white/10" />
              )}
              <div className="mb-1">
                {group.title && (
                  <p className="px-2 pb-1 pt-2 text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                    {group.title}
                  </p>
                )}
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all duration-150",
                        active
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/50 hover:bg-white/5 hover:text-white/80"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#C8A84B] rounded-r-full" />
                      )}
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#C8A84B]" : "")} />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* 사용자 정보 */}
      {session && (
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-8 h-8 rounded-full bg-[#C8A84B]/20 border border-[#C8A84B]/40 flex items-center justify-center text-[13px] font-bold text-[#C8A84B] shrink-0">
              {session.user?.name?.[0] ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{session.user?.name}</p>
              <span className="text-[10px] text-white/40">{level}</span>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 w-full text-[11px] text-white/30 hover:text-white/60 py-1 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            로그아웃
          </button>
        </div>
      )}
    </aside>
  );
}
