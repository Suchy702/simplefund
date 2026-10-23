import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PerformanceChart } from '@/components/PerformanceChart'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolioPerformance } from '@/api/portfolio'
import { cn } from '@/lib/utils'
import { fmtMoney, fmtPct } from '@/lib/formatters'
import type { RangeKey } from '@/types/portfolio'

const RANGES: RangeKey[] = ['1M', '3M', '6M', '1R', 'MAX']

interface PerformanceCardProps {
  range: RangeKey
  onRangeChange: (range: RangeKey) => void
}

export const PerformanceCard = ({
  range,
  onRangeChange,
}: PerformanceCardProps) => {
  const { data, isLoading } = usePortfolioPerformance(range)
  const headline = data?.performance

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
        {isLoading ? (
          <Skeleton className="mb-4 h-7 w-60" />
        ) : headline ? (
          <div
            className={cn(
              'mb-4 mt-1 text-26 font-medium tabular leading-tight',
              headline.change >= 0 ? 'text-pos' : 'text-neg'
            )}
          >
            {fmtMoney(headline.change, 'PLN', { sign: true })} (
            {headline.changePct === null
              ? '—'
              : fmtPct(headline.changePct, { sign: true })}
            )
          </div>
        ) : (
          <p className="mb-4 text-ink-3">
            Brak pełnej historii wycen dla tego okresu.
          </p>
        )}
        <PerformanceChart range={range} height={300} />
      </CardContent>
    </Card>
  )
}
