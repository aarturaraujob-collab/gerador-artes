import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Typography } from "@/components/ui/typography";

interface SectionProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, description, action, children, className }: SectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {title && <Typography variant="h2">{title}</Typography>}
            {description && (
              <Typography variant="subtitle" className="mt-1">
                {description}
              </Typography>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
