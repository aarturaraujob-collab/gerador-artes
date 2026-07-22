import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  'aria-label': string;
  size?: 'sm' | 'default' | 'lg';
}

const sizeClass: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-8 w-8',
  default: 'h-9 w-9',
  lg: 'h-10 w-10',
};

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'default', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        className={cn('p-0', sizeClass[size], className)}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';

export { IconButton };
