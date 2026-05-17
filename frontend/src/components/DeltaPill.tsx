import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fmtPct } from '@/lib/formatters';

interface DeltaPillProps {
  value: number;
  className?: string;
}

export function DeltaPill({ value, className }: DeltaPillProps) {
  const positive = value >= 0;
  return (
    <Badge
      variant={positive ? 'pos' : 'neg'}
      className={cn('tabular text-[10px] font-medium', className)}
    >
      {fmtPct(value, { sign: true })}
    </Badge>
  );
}
