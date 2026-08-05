"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StatusBadge, ProgressSteps } from "@/components/status-badge";
import { PROJECT_STATUS_LABELS, DEV_STAGE_LABELS } from "@/lib/lifecycle-labels";

type MyProject = {
  id: string; title: string; status: string; createdAt: string;
  agent?: { devStage?: string; phase?: string; prodStatus?: string } | null;
  pendingAppeal?: boolean;
};

/** 직원용 내 AI 활용 목록 — 내부 코드(devStage 등) 대신 쉬운 라벨 + 진행 바 노출 */
export default function MyProjectsPage() {
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects?mine=1") // 기존 GET /api/projects의 역할별 필터 활용
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">내 AI 활용</h1>
          <p className="mt-1 text-sm text-muted-foreground">신청한 AI 활용의 진행 상황을 확인하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/projects/new"><Plus className="mr-1.5 h-4 w-4" />직접 작성</Link>
          </Button>
          <Button asChild>
            <Link href="/chat"><Plus className="mr-1.5 h-4 w-4" />AI 상담</Link>
          </Button>
        </div>
      </div>

      {loading && <p className="py-10 text-center text-sm text-muted-foreground">불러오는 중…</p>}

      {!loading && projects.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="text-sm text-muted-foreground">아직 신청한 AI 활용이 없습니다.</p>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/projects/new">직접 양식으로 신청하기</Link></Button>
            <Button asChild variant="outline"><Link href="/chat">AI 상담으로 구체화하기</Link></Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {projects.map((p) => {
          // 에이전트가 생성됐으면 에이전트 단계가, 아니면 AI 활용 상태가 사용자의 현재 위치
          const info = p.agent?.devStage
            ? DEV_STAGE_LABELS[p.agent.devStage] ?? PROJECT_STATUS_LABELS[p.status]
            : p.agent?.prodStatus
              ? { label: "정식 운영 중", step: 5, tone: "success" as const }
              : PROJECT_STATUS_LABELS[p.status] ?? { label: p.status, step: 0, tone: "default" as const };
          return (
            <Link key={p.id} href={`/status/${p.id}`} className="block">
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium">{p.title}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.pendingAppeal && <StatusBadge label="이의제기 진행 중" tone="warning" />}
                      <StatusBadge label={info.label} tone={info.tone} />
                    </div>
                  </div>
                  <ProgressSteps step={info.step} />
                  <p className="text-xs text-muted-foreground">
                    신청일 {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
