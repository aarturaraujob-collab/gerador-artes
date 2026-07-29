import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  className?: string;
  /** Optional color accent (e.g. "border-t-chart-2 [&_[data-value]]:text-chart-2") for pages that want more visual variety per stat. */
  accentClassName?: string;
}

export function StatCard({ label, value, className, accentClassName }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-t-4 border-card-border bg-card px-4 py-3",
        accentClassName,
        className,
      )}
    >
      <p className="font-display text-xs font-medium text-foreground-muted">{label}</p>
      <p data-value className="mt-1 font-mono text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}
