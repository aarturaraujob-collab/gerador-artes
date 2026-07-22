import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "success" | "info" | "warning";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  trend?: { label: string; direction: "up" | "down" | "neutral" };
  className?: string;
}

const toneClass: Record<Tone, string> = {
  brand: "bg-brand/10 text-brand",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
};

// "-solid" (não o tom vivo) porque isto é texto de verdade, não ícone —
// verde/vermelho puros não fecham 4.5:1 de contraste em texto pequeno.
const trendClass: Record<NonNullable<MetricCardProps["trend"]>["direction"], string> = {
  up: "text-success-solid",
  down: "text-danger-solid",
  neutral: "text-foreground-muted",
};

export function MetricCard({
  label,
  value,
  icon,
  tone = "brand",
  trend,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-card-border bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground-secondary">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              toneClass[tone],
            )}
          >
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <p className={cn("mt-3 text-xs font-medium", trendClass[trend.direction])}>
          {trend.label}
        </p>
      )}
    </div>
  );
}
