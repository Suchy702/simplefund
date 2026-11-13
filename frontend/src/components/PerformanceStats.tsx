import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolioPerformance } from '@/api/portfolio'
import { cn } from '@/lib/utils'
import { fmtMoney, fmtPct } from '@/lib/formatters'
import { formatSeriesDate } from '@/lib/performance'
import type { RangeKey } from '@/types/portfolio'

interface PerformanceStatsProps {
  range: RangeKey
}

interface CellProps {
  label: string
  value: React.ReactNode
  sub: React.ReactNode
  toneClass?: string
}

const StatCell = ({ label, value, sub, toneClass }: CellProps) => (
  <div>
    <div className="mb-1 text-tiny font-medium uppercase leading-snug tracking-wide text-ink-3">
      {label}
    </div>
    <div
      className={cn(
        'mb-1 text-28 font-medium tabular leading-tight tracking-tighter2 text-foreground',
        toneClass
      )}
    >
      {value}
    </div>
    <div className="text-xs text-ink-3">{sub}</div>
  </div>
)

export const PerformanceStats = ({ range }: PerformanceStatsProps) => {
  const { data, isLoading } = usePortfolioPerformance(range)
  const stats = data?.performance

  if (isLoading) {
    return (
      <Card className="mb-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="grid grid-cols-2 gap-6 xl:grid-cols-4 xl:gap-8 [&>div]:min-w-0 [&>div]:[overflow-wrap:anywhere]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="mb-1 h-3 w-24 max-w-full" />
              <Skeleton className="h-7 w-32 max-w-full" />
              <Skeleton className="mt-2 h-3 w-28 max-w-full" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (!stats) {
    return (
      <Card className="mb-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6 text-ink-3">
        Brak danych do obliczenia statystyk.
      </Card>
    )
  }

  const { peak, trough, peakDate, troughDate, stdPct, maxDd, maxDdPln } = stats

  return (
    <Card className="mb-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <div className="grid grid-cols-2 gap-6 xl:grid-cols-4 xl:gap-8 [&>div]:min-w-0 [&>div]:[overflow-wrap:anywhere]">
        <StatCell
          label="Szczyt (ATH)"
          value={Math.round(peak).toLocaleString('pl-PL')}
          sub={`PLN · ${formatSeriesDate(peakDate)}`}
        />
        <StatCell
          label="Minimum"
          value={Math.round(trough).toLocaleString('pl-PL')}
          sub={`PLN · ${formatSeriesDate(troughDate)}`}
        />
        <StatCell
          label="Odch. standardowe"
          value={
            stdPct === null ? '—' : `${stdPct.toFixed(1).replace('.', ',')}%`
          }
          sub="annualizowane"
        />
        <StatCell
          label="Maks. obsunięcie"
          value={fmtPct(maxDd * 100)}
          sub={`${fmtMoney(maxDdPln, 'PLN')} od ATH`}
          toneClass="text-neg"
        />
      </div>
    </Card>
  )
}
