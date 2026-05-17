import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PerformanceChart } from '@/components/PerformanceChart';
import { Skeleton } from '@/components/ui/skeleton';
import { usePortfolioSeries } from '@/api/portfolio';
import { cn } from '@/lib/utils';
import { fmtMoney, fmtPct } from '@/lib/formatters';
import type { RangeKey } from '@/types/portfolio';

const RANGES: RangeKey[] = ['1M', '3M', '6M', '1R', 'MAX'];

interface PerformanceCardProps {
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
}

export function PerformanceCard({ range, onRangeChange }: PerformanceCardProps) {
  const { data: series, isLoading } = usePortfolioSeries(range);

  const headline = series && series.length > 0
    ? (() => {
        const chgAbs = series[series.length - 1] - series[0];
        const chgPct = (chgAbs / series[0]) * 100;
        const positive = chgAbs >= 0;
        return { chgAbs, chgPct, positive };
      })()
    : null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <div>
          <CardTitle>Wyniki w czasie</CardTitle>
          <CardDescription>Wartość portfela · {range}</CardDescription>
        </div>
        <Tabs value={range} onValueChange={(v) => onRangeChange(v as RangeKey)}>
          <TabsList>
            {RANGES.map((r) => (
              <TabsTrigger key={r} value={r}>
                {r}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {isLoading || !headline ? (
          <Skeleton className="mb-4 h-7 w-60" />
        ) : (
          <div
            className={cn(
              'mb-4 mt-1 text-26 font-medium tabular leading-tight',
              headline.positive ? 'text-pos' : 'text-neg',
            )}
          >
            {fmtMoney(headline.chgAbs, 'PLN', { sign: true })} (
            {fmtPct(headline.chgPct, { sign: true })})
          </div>
        )}
        <PerformanceChart range={range} height={300} />
      </CardContent>
    </Card>
  );
}
