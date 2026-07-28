import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EMPLOYEE_STEPS, type Tone } from "@/lib/lifecycle-labels";

const TONE_CLASS: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  success: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function StatusBadge({ label, tone = "default" }: { label: string; tone?: Tone }) {
  return <Badge variant="outline" className={cn("border-transparent font-normal", TONE_CLASS[tone])}>{label}</Badge>;
}

/** 직원 화면용 6단계 진행 바 — 내부 코드 대신 여정을 보여준다 */
export function ProgressSteps({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`진행 단계: ${EMPLOYEE_STEPS[step]}`}>
      {EMPLOYEE_STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={cn("h-1.5 w-7 rounded-full", i <= step ? "bg-primary" : "bg-muted")}
            title={s}
          />
        </div>
      ))}
      <span className="ml-2 text-xs text-muted-foreground">{EMPLOYEE_STEPS[step]}</span>
    </div>
  );
}
