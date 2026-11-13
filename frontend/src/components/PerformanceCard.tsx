import { useEffect, useId, useState, type CSSProperties } from 'react'
import { Info, Loader2, RefreshCw } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { PerformanceChart } from '@/components/PerformanceChart'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolioPerformance, useRecalculateHistory } from '@/api/portfolio'
import { cn } from '@/lib/utils'
import { fmtMoney, fmtPct } from '@/lib/formatters'
import type { RangeKey } from '@/types/portfolio'

const RANGES: RangeKey[] = ['1M', '3M', '6M', '1R', 'MAX']
const RANGE_LABELS: Record<RangeKey, string> = {
  '1M': '1 mies.',
  '3M': '3 mies.',
  '6M': '6 mies.',
  '1R': '1 rok',
  MAX: 'Całość',
}

interface PerformanceCardProps {
  range: RangeKey
  onRangeChange: (range: RangeKey) => void
}

export const PerformanceCard = ({
  range,
  onRangeChange,
}: PerformanceCardProps) => {
  const history = usePortfolioPerformance(range)
  const { data, isLoading } = history
  const refresh = useRecalculateHistory()
  const [showContribution, setShowContribution] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [now, setNow] = useState(Date.now)
  const infoId = useId()
  const headline = data?.performance
  const hasHistory = Boolean(data?.calculatedAt)
  const running = data?.status === 'running' || refresh.isPending
  const error = refresh.error?.message ?? history.error?.message ?? data?.error
  const remaining = data?.nextCalculationAt
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(data.nextCalculationAt) -
            Date.parse(data.serverTime) -
            (now - history.dataUpdatedAt)) /
            1000
        )
      )
    : 0
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
  const incomplete = hasHistory && Boolean(data?.series.length) && !headline
  const noDataMessage =
    'Brak danych do obliczenia wykresu. Dodaj operację z datą do dzisiaj.'
  const refreshLabel = running
    ? 'Obliczanie historii'
    : !data?.canCalculate
      ? noDataMessage
      : remaining > 0
        ? `Kolejne przeliczenie za ${countdown}`
        : 'Przelicz historię'
  const refreshDisabled =
    !data?.canCalculate || running || remaining > 0 || isLoading

  useEffect(() => {
    setNow(Date.now())
    if (!data?.nextCalculationAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [data?.nextCalculationAt, history.dataUpdatedAt])

  const amount = headline
    ? fmtMoney(headline.change, 'PLN', { sign: true })
    : ''
  const percentage =
    headline?.changePct != null
      ? `(${fmtPct(headline.changePct, { sign: true })})`
      : null
  const headlineWidth =
    amount.length + (percentage ? percentage.length * 0.75 + 1 : 0)
  const contributionToggle = (mobile: boolean) => (
    <label
      className={cn(
        'relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm text-13 text-ink-2 hover:text-foreground',
        !mobile && 'md:min-h-8 md:px-1.5 md:text-xs'
      )}
    >
      <input
        type="checkbox"
        checked={showContribution}
        onChange={(event) => setShowContribution(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-[18px] w-[34px] shrink-0 rounded-full border border-ink-3 bg-surface-subtle transition-colors peer-checked:border-blue-500 peer-checked:bg-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card"
      >
        <span
          className={cn(
            'absolute left-[3px] top-[3px] h-2.5 w-2.5 rounded-full bg-ink-3 transition-transform',
            showContribution && 'translate-x-4 bg-white'
          )}
        />
      </span>
      {mobile ? 'Pokaż wkład własny' : 'Wkład własny'}
    </label>
  )
  const refreshButton = (mobile: boolean) => (
    <span title={refreshLabel}>
      <Button
        type="button"
        variant="ghost"
        size={!mobile && remaining > 0 ? 'sm' : 'icon'}
        className={cn(
          'gap-1.5',
          mobile
            ? 'h-11 w-11 shrink-0 text-inherit hover:bg-transparent hover:text-inherit'
            : 'h-8',
          data?.stale && !mobile && 'text-amber-600'
        )}
        disabled={refreshDisabled}
        aria-label={refreshLabel}
        onClick={() => refresh.mutate()}
      >
        {running ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <RefreshCw size={15} />
        )}
        {!mobile && !running && remaining > 0 && (
          <span className="font-mono text-xs tabular">{countdown}</span>
        )}
      </Button>
    </span>
  )

  return (
    <Card className="relative mb-4 rounded-[22px] md:rounded-lg">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-4 border-b-0 p-4 pb-0 md:flex md:flex-wrap md:gap-3 md:border-b md:pb-4">
        <CardTitle className="text-[17px] md:text-sm">
          <span className="md:hidden">Wyniki portfela</span>
          <span className="hidden md:inline">Wyniki historyczne</span>
        </CardTitle>
        <div className="justify-self-end md:order-last">
          <Popover open={infoOpen} onOpenChange={setInfoOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 md:h-8 md:w-8"
                aria-label="Szczegóły wykresu"
                title="Szczegóły wykresu"
              >
                <Info size={14} />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 max-w-[calc(100vw-2rem)] space-y-3 text-xs text-ink-3"
              aria-labelledby={infoId}
            >
              <h3 id={infoId} className="font-medium text-foreground">
                Szczegóły wykresu
              </h3>
              {data?.calculatedAt && (
                <p>
                  Obliczono:{' '}
                  {new Date(data.calculatedAt).toLocaleString('pl-PL')}
                </p>
              )}
              {running && (
                <p role="status">
                  Trwa przeliczanie pełnej historii. Wykres pokazuje ostatni
                  zapisany wynik.
                </p>
              )}
              {data?.stale && (
                <p>
                  Wynik wymaga odświeżenia po zmianie operacji, wycen ręcznych
                  lub dnia wyceny.
                </p>
              )}
              {error && <p className="text-neg">{error}</p>}
              {data?.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              {incomplete && !data?.warnings.length && (
                <p>Brak pełnej historii wycen dla tego okresu.</p>
              )}
              <p>Zmiana wartości uwzględnia wpłaty i wypłaty.</p>
              <p>
                Przeliczanie uruchamiasz ręcznie. Jest dostępne co 5 minut, aby
                ograniczyć duże obciążenie naszych serwisów i zewnętrznych
                dostawców danych.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        {headline && (
          <>
            <div className="col-span-2 min-w-0 [container-type:inline-size] md:hidden">
              <p
                className="whitespace-nowrap font-mono text-[length:var(--headline-font)] font-semibold leading-tight tracking-tight tabular"
                style={
                  {
                    '--headline-font': `clamp(0.625rem, ${100 / Math.max(1, headlineWidth * 0.64)}cqw, 2.2rem)`,
                  } as CSSProperties
                }
                title="Zmiana wartości w wybranym okresie, z uwzględnieniem wpłat i wypłat"
              >
                {amount}
                {percentage && (
                  <span
                    className={cn(
                      'ml-1.5 text-[0.75em]',
                      headline.changePct! >= 0 ? 'text-pos' : 'text-neg'
                    )}
                  >
                    {percentage}
                  </span>
                )}
              </p>
            </div>
            <span
              className={cn(
                'hidden font-mono text-sm font-medium tabular md:inline',
                headline.change >= 0 ? 'text-pos' : 'text-neg'
              )}
              title="Zmiana wartości w wybranym okresie, z uwzględnieniem wpłat i wypłat"
            >
              {amount}
              {headline.changePct !== null && (
                <span className="ml-1.5 text-xs">
                  ({fmtPct(headline.changePct, { sign: true })})
                </span>
              )}
            </span>
          </>
        )}
        <Tabs
          className="col-span-2 w-full md:ml-auto md:w-auto"
          value={range}
          onValueChange={(value) => onRangeChange(value as RangeKey)}
        >
          <TabsList className="grid w-full grid-cols-5 gap-0.5 rounded-xl p-1 md:inline-flex md:w-auto md:rounded-sm md:p-0.5">
            {RANGES.map((item) => (
              <TabsTrigger
                key={item}
                value={item}
                className="min-h-11 rounded-lg px-1 py-2 text-xs data-[state=active]:bg-foreground data-[state=active]:text-card md:min-h-0 md:rounded-[4px] md:px-2.5 md:py-1 md:data-[state=active]:bg-card md:data-[state=active]:text-foreground"
              >
                <span className="md:hidden">{RANGE_LABELS[item]}</span>
                <span className="hidden md:inline">{item}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="hidden items-center gap-1 md:flex">
          {contributionToggle(false)}
          {hasHistory && refreshButton(false)}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-3 md:pb-3 md:pt-2">
        {hasHistory && (
          <p className="mb-1 text-13 font-medium md:hidden">
            Wartość portfela{' '}
            <span className="font-normal text-ink-3">· tys. PLN</span>
          </p>
        )}
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
          aria-live="polite"
        >
          {hasHistory && (
            <>
              <span className="hidden items-center gap-1.5 text-ink-3 md:inline-flex">
                <span
                  className="w-4 border-t-2 border-pos"
                  aria-hidden="true"
                />
                Portfel
              </span>
            </>
          )}
          {error && (
            <button
              type="button"
              role="alert"
              onClick={() => setInfoOpen(true)}
              className="rounded-sm py-1 text-neg underline-offset-2 hover:underline"
            >
              Błąd · szczegóły
            </button>
          )}
          {data?.stale && (
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="hidden rounded-sm py-1 text-amber-600 hover:underline md:inline"
            >
              Nieaktualne
            </button>
          )}
        </div>
        <span className="sr-only" role="status">
          {running ? 'Obliczanie historii' : ''}
        </span>
        {isLoading ? (
          <Skeleton className="mt-2 h-28 w-full" />
        ) : hasHistory ? (
          <PerformanceChart
            series={data?.series ?? []}
            showContribution={showContribution}
            height={300}
            mobileLayout
          />
        ) : (
          <div className="flex min-h-24 flex-col items-center justify-center gap-2 py-5">
            {data && !data.canCalculate && !running && (
              <p className="text-center text-xs text-ink-3">{noDataMessage}</p>
            )}
            {(data?.canCalculate || running) && (
              <span title={refreshLabel}>
                <Button
                  type="button"
                  size="sm"
                  disabled={refreshDisabled}
                  onClick={() => refresh.mutate()}
                >
                  {running ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {running
                    ? 'Obliczanie…'
                    : remaining > 0
                      ? countdown
                      : 'Oblicz wykres'}
                </Button>
              </span>
            )}
          </div>
        )}
        {hasHistory && (
          <div className="mt-1 flex items-center justify-between gap-2 md:hidden">
            {contributionToggle(true)}
            <div
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-lg px-1 text-xs',
                error
                  ? 'bg-[var(--neg-soft)] text-neg'
                  : data?.stale
                    ? 'text-brand-ink'
                    : 'text-ink-2'
              )}
            >
              {(error || data?.stale) && (
                <span role="status">{error ? 'Błąd' : 'Nieaktualne'}</span>
              )}
              {refreshButton(true)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
