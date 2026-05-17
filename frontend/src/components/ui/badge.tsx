import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-[4px] border px-2 py-0.5 text-tiny font-medium uppercase tracking-wider2 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface-subtle text-ink-2',
        buy: 'border-transparent bg-pos-soft text-pos',
        sell: 'border-transparent bg-neg-soft text-neg',
        pos: 'border-transparent bg-pos-soft text-pos rounded-full normal-case tracking-normal',
        neg: 'border-transparent bg-neg-soft text-neg rounded-full normal-case tracking-normal',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
