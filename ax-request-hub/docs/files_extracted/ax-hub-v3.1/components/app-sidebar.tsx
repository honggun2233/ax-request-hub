"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Plus, MessageCircle, ListChecks, Database, FileText, Star, Book,
  User, Wrench, Users, BarChart3, Scale, Cpu, Gavel, Archive, Coins,
  GraduationCap, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/authz";

type NavItem = { href: string; label: string; icon: React.ElementType; roles?: Role[] };
type NavGroup = { title?: string; items: NavItem[]; roles?: Role[] };

/** 사이드바 IA — 업무 단위 그룹핑. roles 미지정 = 로그인 전체 노출 */
const NAV: NavGroup[] = [
  { items: [{ href: "/", label: "홈", icon: Home }] },
  {
    title: "AI 과제",
    items: [
      { href: "/submit", label: "과제 신청", icon: Plus },
      { href: "/chat", label: "AI 상담", icon: MessageCircle },
      { href: "/me/projects", label: "내 과제", icon: ListChecks },
    ],
  },
  {
    title: "데이터",
    items: [
      { href: "/data/catalog", label: "데이터 카탈로그", icon: Database },
      { href: "/me/data", label: "내 데이터 신청", icon: FileText },
    ],
  },
  {
    title: "리소스",
    items: [
      { href: "/skills", label: "스킬 라이브러리", icon: Star },
      { href: "/docs", label: "거버넌스 문서", icon: Book },
    ],
  },
  {
    title: "내 정보",
    items: [
      { href: "/me", label: "프로필 · 레벨 · 교육", icon: User },
      { href: "/me/tools", label: "내 도구 · 사용량", icon: Wrench },
    ],
  },
  {
    title: "부서 관리",
    roles: ["DEPT_HEAD", "AX_TEAM"],
    items: [{ href: "/dept/tools", label: "AI 도구 배정", icon: Users }],
  },
  {
    title: "데이터 운영",
    roles: ["DATA_PLATFORM", "AX_TEAM"],
    items: [
      { href: "/dp/requests", label: "데이터 요청 처리", icon: FileText },
      { href: "/dp/catalog", label: "카탈로그 관리", icon: Database },
    ],
  },
  {
    title: "경영",
    roles: ["EXECUTIVE", "C_LEVEL", "AX_TEAM"],
    items: [{ href: "/executive", label: "경영 대시보드", icon: BarChart3 }],
  },
  {
    title: "과제 운영",
    roles: ["AX_TEAM"],
    items: [
      { href: "/dashboard", label: "과제 대시보드", icon: BarChart3 },
      { href: "/dashboard?tab=appeals", label: "이의제기 처리", icon: Scale },
    ],
  },
  {
    title: "에이전트",
    roles: ["AX_TEAM"],
    items: [
      { href: "/registry", label: "레지스트리", icon: Cpu },
      { href: "/council", label: "협의회 기록", icon: Gavel },
      { href: "/admin/retired", label: "폐기 아카이브", icon: Archive },
    ],
  },
  {
    title: "자원",
    roles: ["AX_TEAM"],
    items: [
      { href: "/admin/tools", label: "도구 계정 · 쿼터", icon: Wrench },
      { href: "/admin/tokens", label: "토큰 정책 · 배분", icon: Coins },
    ],
  },
  {
    title: "사람 · 지식",
    roles: ["AX_TEAM"],
    items: [
      { href: "/admin/employees", label: "직원 · 역할", icon: Users },
      { href: "/admin/literacy", label: "리터러시 심사", icon: GraduationCap },
      { href: "/admin/skills", label: "스킬 · 문서 관리", icon: Star },
    ],
  },
  {
    title: "거버넌스",
    roles: ["AX_TEAM"],
    items: [{ href: "/governance", label: "감사 로그", icon: Shield }],
  },
  // /admin/agents (레거시)는 의도적으로 제외 — v3 이관 완료로 메뉴 제거
];

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const visible = NAV.filter((g) => !g.roles || g.roles.includes(role));
  return (
    <nav className="flex h-full w-60 flex-col gap-1 overflow-y-auto border-r bg-background px-3 py-4">
      {visible.map((group, gi) => (
        <div key={gi} className="mb-2">
          {group.title && (
            <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">{group.title}</p>
          )}
          {group.items.map((item) => {
            const active = pathname === item.href.split("?")[0];
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active ? "bg-accent font-medium text-accent-foreground" : "text-foreground/80 hover:bg-accent/50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
