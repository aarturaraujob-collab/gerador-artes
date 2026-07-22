import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const typographyVariants = cva('', {
  variants: {
    variant: {
      h1: 'text-3xl md:text-4xl font-semibold tracking-tight text-foreground',
      h2: 'text-2xl font-semibold tracking-tight text-foreground',
      h3: 'text-lg font-semibold text-foreground',
      subtitle: 'text-base font-medium text-foreground-secondary',
      body: 'text-sm font-normal text-foreground',
      caption: 'text-xs font-normal text-foreground-muted',
      overline: 'text-xs font-semibold uppercase tracking-wide text-foreground-muted',
    },
  },
  defaultVariants: {
    variant: 'body',
  },
});

type TypographyVariant = NonNullable<VariantProps<typeof typographyVariants>['variant']>;

const defaultElement: Record<TypographyVariant, keyof React.JSX.IntrinsicElements> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  subtitle: 'p',
  body: 'p',
  caption: 'span',
  overline: 'span',
};

export interface TypographyProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof typographyVariants> {
  as?: keyof React.JSX.IntrinsicElements;
}

const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant, as, ...props }, ref) => {
    const resolvedVariant: TypographyVariant = variant ?? 'body';
    const Comp = (as ?? defaultElement[resolvedVariant]) as React.ElementType;
    return (
      <Comp
        ref={ref}
        className={cn(typographyVariants({ variant: resolvedVariant }), className)}
        {...props}
      />
    );
  },
);
Typography.displayName = 'Typography';

export { Typography, typographyVariants };
