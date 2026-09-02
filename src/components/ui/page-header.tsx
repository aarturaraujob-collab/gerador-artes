import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Typography } from "@/components/ui/typography";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** Renderiza o card gradiente (padrão do FAF Lab / CompetitionHub), sem logo. */
  hero?: boolean;
}

export function PageHeader({ title, description, actions, className, hero }: PageHeaderProps) {
  if (hero) {
    return (
      <header
        className={cn(
          "relative -mx-4 flex flex-wrap items-center gap-4 overflow-hidden border border-black/5 bg-gray-100 px-4 py-6 text-foreground sm:mx-0 sm:rounded-2xl sm:px-8",
          className,
        )}
        style={{
          backgroundImage:
            "radial-gradient(120% 140% at 10% 10%, rgba(255,255,255,0.9), transparent 55%)," +
            "radial-gradient(100% 120% at 90% 90%, rgba(0,0,0,0.06), transparent 55%)," +
            "linear-gradient(135deg, #ffffff 0%, #e9eaec 100%)",
        }}
      >
        <div className="relative min-w-0 flex-1">
          <h1 className="font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl">{title}</h1>
          {description && (
            <p className="font-display text-sm font-medium text-foreground-secondary">{description}</p>
          )}
        </div>
        {actions && <div className="relative flex items-center gap-3">{actions}</div>}
      </header>
    );
  }

  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        <Typography variant="h1">{title}</Typography>
        {description && (
          <Typography variant="subtitle" className="mt-2">
            {description}
          </Typography>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}
