import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolioSeries } from '@/api/portfolio'
import { cn } from '@/lib/utils'
import { fmtMoney, fmtPct } from '@/lib/formatters'
import type { RangeKey } from '@/types/portfolio'

interface PerformanceStatsProps {
  range: RangeKey
}

function labelAt(range: RangeKey, ratio: number): string {
  if (range === 'MAX') return `${2021 + Math.round(ratio * 5)}`
  if (range === '1R') {
    const months = [
      'kwi',
      'maj',
      'cze',
      'lip',
      'sie',
      'wrz',
      'paź',
      'lis',
      'gru',
      'sty',
      'lut',
      'mar',
    ]
    const i = Math.floor(ratio * 11.99)
    const year = i < 9 ? 2025 : 2026
    return `${months[i]} ${String(year).slice(2)}`
  }
  if (range === '6M') {
    const months = ['lis', 'gru', 'sty', 'lut', 'mar', 'kwi']
    return `${months[Math.floor(ratio * 5.99)]} 26`
  }
  if (range === '3M') {
    const months = ['lut', 'mar', 'kwi']
    return `${months[Math.floor(ratio * 2.99)]} 26`
  }
  if (range === '1M') return `${30 - Math.round(ratio * 30)}d temu`
  return ''
}

interface CellProps {
  label: string
  value: React.ReactNode
  sub: React.ReactNode
  toneClass?: string
}

function StatCell({ label, value, sub, toneClass }: CellProps) {
  return (
    <div>
      <div className="mb-2 text-tiny font-medium uppercase tracking-widest2 text-ink-3">
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
}

export function PerformanceStats({ range }: PerformanceStatsProps) {
  const { data: series, isLoading } = usePortfolioSeries(range)

  if (isLoading || !series) {
    return (
      <Card className="mb-4 px-8 py-6">
        <div className="grid grid-cols-4 gap-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="mb-2 h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  const peak = Math.max(...series)
  const trough = Math.min(...series)
  const peakIdx = series.indexOf(peak)
  const troughIdx = series.indexOf(trough)
  const peakLabel = labelAt(range, peakIdx / (series.length - 1))
  const troughLabel = labelAt(range, troughIdx / (series.length - 1))

  const mean = series.reduce((a, b) => a + b, 0) / series.length
  const variance =
    series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length
  const stdPct = (Math.sqrt(variance) / mean) * 100

  let maxDd = 0
  let peakSoFar = series[0]
  for (const v of series) {
    if (v > peakSoFar) peakSoFar = v
    const dd = (v - peakSoFar) / peakSoFar
    if (dd < maxDd) maxDd = dd
  }
  const maxDdPln = maxDd * peak

  return (
    <Card className="mb-4 px-8 py-6">
      <div className="grid grid-cols-4 gap-8">
        <StatCell
          label="Szczyt (ATH)"
          value={Math.round(peak).toLocaleString('pl-PL')}
          sub={`PLN · ${peakLabel}`}
        />
        <StatCell
          label="Minimum"
          value={Math.round(trough).toLocaleString('pl-PL')}
          sub={`PLN · ${troughLabel}`}
        />
        <StatCell
          label="Odch. standardowe"
          value={`${stdPct.toFixed(1).replace('.', ',')}%`}
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
