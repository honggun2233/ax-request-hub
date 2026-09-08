"use client";

import Link from "next/link";
import {
  Lightbulb,
  Globe,
  Package,
  Database,
  BookOpen,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DocRef = { code: string; title: string };
type ScenarioLink = { label: string; href: string; primary?: boolean };

type Scenario = {
  icon: React.ElementType;
  accent: string;
  title: string;
  desc: string;
  steps: string[];
  docs: DocRef[];
  links: ScenarioLink[];
};

const SCENARIOS: Scenario[] = [
  {
    icon: Lightbulb,
    accent: "amber",
    title: "새 AI 과제를 시작하고 싶다",
    desc: "아이디어가 있거나 업무 문제를 AI로 해결하고 싶을 때",
    steps: [
      "제안서 양식(AI-STD-2026-007)에 따라 과제 개요 작성",
      "AX Hub '과제 신청'으로 제출",
      "AX팀 검토 후 Phase 1 개발 착수",
    ],
    docs: [
      { code: "AI-STD-2026-007", title: "AI 과제 제안서 양식" },
      { code: "AI-STD-2026-006", title: "전사 AI 과제 개발 표준" },
    ],
    links: [
      { label: "과제 신청하기 →", href: "/chat", primary: true },
      { label: "규정 · 문서 전체 보기", href: "/docs" },
    ],
  },
  {
    icon: Globe,
    accent: "blue",
    title: "외부 AI 도구·솔루션을 도입하고 싶다",
    desc: "Copilot, 외부 AI API, 벤더 AI 등 사외에서 만든 것을 업무에 적용하고 싶을 때",
    steps: [
      "전사 표준 도구 목록 확인 — 있으면 A형(간단 신청)",
      "없으면 도입 유형 판단: 부서 단독(B형) vs 전사 확산(C형)",
      "자가점검 4항목(데이터 위치·학습활용·기밀등급·DLP) 확인 후 신청",
    ],
    docs: [
      { code: "AI-STD-2026-008", title: "외부 AI 솔루션 도입 표준" },
    ],
    links: [
      { label: "도구 & 서비스 목록", href: "/me/tools", primary: true },
      { label: "규정 · 문서 전체 보기", href: "/docs" },
    ],
  },
  {
    icon: Package,
    accent: "green",
    title: "만든 에이전트를 등록하고 싶다",
    desc: "PoC 개발을 마쳤거나 전사 배포를 위해 AX Hub Gate를 거치고 싶을 때",
    steps: [
      "Phase 1 완료 제출물 4종 준비(시연·입출력 명세·저장소·기밀등급)",
      "AX Hub '에이전트 등록 신청'에서 인수 신청",
      "AX팀 Gate 1→2→3 검토 통과 후 전사 배포",
    ],
    docs: [
      { code: "AI-STD-2026-006", title: "전사 AI 과제 개발 표준" },
      { code: "AI-STD-2026-007", title: "AI 과제 제안서 양식" },
    ],
    links: [
      { label: "에이전트 등록 신청 →", href: "/projects/new", primary: true },
      { label: "규정 · 문서 전체 보기", href: "/docs" },
    ],
  },
  {
    icon: Database,
    accent: "purple",
    title: "AI 개발에 필요한 데이터를 요청하고 싶다",
    desc: "과제 개발 또는 학습에 필요한 사내 데이터 접근권을 신청할 때",
    steps: [
      "데이터 카탈로그에서 원하는 데이터셋 확인",
      "기밀등급(G1 공개 / G2 대외비 / G3 기밀) 및 사용 목적 명시",
      "데이터 신청 제출 → 데이터플랫폼팀 검토",
    ],
    docs: [],
    links: [
      { label: "데이터 카탈로그 →", href: "/data/catalog", primary: true },
      { label: "내 데이터 신청 현황", href: "/me/data" },
    ],
  },
  {
    icon: ShieldCheck,
    accent: "red",
    title: "데이터 기밀등급이 궁금하다",
    desc: "어떤 데이터를 외부 AI에 넣어도 되는지, G1/G2/G3 구분을 확인하고 싶을 때",
    steps: [
      "G1 공개 — 외부 AI 도구 자유롭게 사용 가능",
      "G2 대외비 — 계약서에 학습활용 금지 명시 시 사용 가능 (파일 업로드 주의)",
      "G3 기밀·극비 — 외부 AI 절대 금지, 온프레미스 모델만 사용",
    ],
    docs: [
      { code: "AI-STD-2026-008", title: "외부 AI 솔루션 도입 표준 §3" },
    ],
    links: [
      { label: "규정 · 문서 보기", href: "/docs", primary: true },
    ],
  },
  {
    icon: BookOpen,
    accent: "slate",
    title: "규정 · 지침 · 표준 전체를 보고 싶다",
    desc: "AI 운영 규정, 각종 표준, 가이드라인을 직접 검색하고 싶을 때",
    steps: [
      "L1 규정 → L2 지침 → L3 가이드라인 → L4 매뉴얼 계층 구조",
      "문서번호 체계: AI-STD-2026-xxx (전사 표준)",
      "ax-dev-2026-xxx (AX Hub 개발·운영 기준)",
    ],
    docs: [],
    links: [
      { label: "문서 전체 보기 →", href: "/docs", primary: true },
    ],
  },
];

const ACCENT: Record<string, { card: string; icon: string; badge: string; btn: string }> = {
  amber: {
    card: "border-amber-500/30 hover:border-amber-400/50",
    icon: "bg-amber-500/15 text-amber-400",
    badge: "bg-amber-500/10 text-amber-300 border border-amber-500/20",
    btn: "bg-amber-500 hover:bg-amber-400 text-white",
  },
  blue: {
    card: "border-blue-500/30 hover:border-blue-400/50",
    icon: "bg-blue-500/15 text-blue-400",
    badge: "bg-blue-500/10 text-blue-300 border border-blue-500/20",
    btn: "bg-blue-500 hover:bg-blue-400 text-white",
  },
  green: {
    card: "border-green-500/30 hover:border-green-400/50",
    icon: "bg-green-500/15 text-green-400",
    badge: "bg-green-500/10 text-green-300 border border-green-500/20",
    btn: "bg-green-500 hover:bg-green-400 text-white",
  },
  purple: {
    card: "border-purple-500/30 hover:border-purple-400/50",
    icon: "bg-purple-500/15 text-purple-400",
    badge: "bg-purple-500/10 text-purple-300 border border-purple-500/20",
    btn: "bg-purple-500 hover:bg-purple-400 text-white",
  },
  red: {
    card: "border-red-500/30 hover:border-red-400/50",
    icon: "bg-red-500/15 text-red-400",
    badge: "bg-red-500/10 text-red-300 border border-red-500/20",
    btn: "bg-red-500 hover:bg-red-400 text-white",
  },
  slate: {
    card: "border-slate-500/30 hover:border-slate-400/50",
    icon: "bg-slate-500/15 text-slate-300",
    badge: "bg-slate-500/10 text-slate-300 border border-slate-500/20",
    btn: "bg-slate-500 hover:bg-slate-400 text-white",
  },
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#0F1E3C]">
      {/* 헤더 */}
      <div className="border-b border-white/8 bg-[#0F1E3C]/80 px-8 py-8">
        <p className="text-xs font-semibold text-[#B8956A] uppercase tracking-widest mb-2">
          시작 가이드
        </p>
        <h1 className="text-2xl font-bold text-white mb-1">무엇을 하려고 하시나요?</h1>
        <p className="text-sm text-white/40">
          상황에 맞는 절차와 표준을 바로 확인하세요.
        </p>
      </div>

      {/* 카드 그리드 */}
      <div className="px-8 py-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 max-w-6xl">
        {SCENARIOS.map((s) => {
          const ac = ACCENT[s.accent];
          const Icon = s.icon;
          return (
            <div
              key={s.title}
              className={cn(
                "flex flex-col rounded-xl border bg-white/4 p-5 transition-colors duration-150",
                ac.card
              )}
            >
              {/* 아이콘 + 제목 */}
              <div className="flex items-start gap-3 mb-3">
                <div className={cn("mt-0.5 rounded-lg p-2 shrink-0", ac.icon)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold text-white leading-snug">{s.title}</h2>
                  <p className="text-[12px] text-white/40 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>

              {/* 단계 */}
              {s.steps.length > 0 && (
                <ol className="mb-3 space-y-1.5">
                  {s.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 text-[10px] font-bold text-white/30 w-4 text-right">
                        {i + 1}.
                      </span>
                      <span className="text-[12px] text-white/55 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              )}

              {/* 관련 문서 뱃지 */}
              {s.docs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {s.docs.map((d) => (
                    <span key={d.code} className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", ac.badge)}>
                      {d.code}
                    </span>
                  ))}
                </div>
              )}

              {/* 액션 링크 */}
              <div className="mt-auto pt-2 flex flex-wrap gap-2">
                {s.links.map((lnk) =>
                  lnk.primary ? (
                    <Link
                      key={lnk.href}
                      href={lnk.href}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
                        ac.btn
                      )}
                    >
                      {lnk.label}
                    </Link>
                  ) : (
                    <Link
                      key={lnk.href}
                      href={lnk.href}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white/40 hover:text-white/70 transition-colors"
                    >
                      {lnk.label}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 도움말 배너 */}
      <div className="mx-8 mb-8 rounded-xl border border-[#B8956A]/20 bg-[#B8956A]/5 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#B8956A]">찾는 내용이 없으신가요?</p>
          <p className="text-xs text-white/40 mt-0.5">
            과제 신청 챗봇에 상황을 말씀하시거나, 규정·문서 전체에서 검색해 보세요.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#B8956A] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#C9A87A] transition-colors"
          >
            챗봇 신청
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-medium text-white/50 hover:text-white/80 transition-colors"
          >
            전체 문서
          </Link>
        </div>
      </div>
    </div>
  );
}
