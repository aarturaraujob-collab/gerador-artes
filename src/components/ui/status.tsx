import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-muted text-muted-foreground',
        // texto usa a variante "-solid" (mais escura) em vez do tom vivo:
        // verde/vermelho/âmbar puros só dão 3.2-4.4:1 sobre fundo claro,
        // abaixo do mínimo AA (4.5:1) para texto normal.
        success: 'border-success/20 bg-success/10 text-success-solid',
        danger: 'border-danger/20 bg-danger/10 text-danger-solid',
        warning: 'border-warning/20 bg-warning/10 text-warning-solid',
        info: 'border-info/20 bg-info/10 text-info-solid',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export interface StatusProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusVariants> {
  dot?: boolean;
}

function Status({ className, tone, dot = true, children, ...props }: StatusProps) {
  return (
    <span className={cn(statusVariants({ tone }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export { Status, statusVariants };
