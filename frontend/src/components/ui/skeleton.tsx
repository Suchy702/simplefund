import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-sm bg-surface-subtle', className)}
      {...props}
    />
  );
}

export { Skeleton };
