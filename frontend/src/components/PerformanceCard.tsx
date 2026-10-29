import { useEffect, useId, useState } from 'react'
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
  const refreshLabel = running
    ? 'Obliczanie historii'
    : remaining > 0
      ? `Kolejne przeliczenie za ${countdown}`
      : 'Przelicz historię'
  const refreshDisabled = running || remaining > 0 || isLoading

  useEffect(() => {
    setNow(Date.now())
    if (!data?.nextCalculationAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [data?.nextCalculationAt, history.dataUpdatedAt])

  return (
    <Card className="relative mb-4">
      <CardHeader className="flex-col items-stretch gap-2 px-4 py-3 md:flex-row md:items-center md:gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <CardTitle>Wyniki historyczne</CardTitle>
          {headline && (
            <span
              className={cn(
                'font-mono text-sm font-medium tabular',
                headline.change >= 0 ? 'text-pos' : 'text-neg'
              )}
              title="Zmiana wartości w wybranym okresie, z uwzględnieniem wpłat i wypłat"
            >
              {fmtMoney(headline.change, 'PLN', { sign: true })}
              {headline.changePct !== null && (
                <span className="ml-1.5 text-xs">
                  ({fmtPct(headline.changePct, { sign: true })})
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Tabs
            value={range}
            onValueChange={(value) => onRangeChange(value as RangeKey)}
          >
            <TabsList className="h-8">
              {RANGES.map((item) => (
                <TabsTrigger
                  key={item}
                  value={item}
                  className="px-2.5 py-1 text-xs"
                >
                  {item}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <label className="relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs text-ink-2 hover:text-foreground">
            <input
              type="checkbox"
              checked={showContribution}
              onChange={(event) => setShowContribution(event.target.checked)}
              className="peer sr-only"
            />
            <span
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-ink-3 peer-checked:border-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card"
              aria-hidden="true"
            >
              {showContribution && (
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              )}
            </span>
            Wkład własny
          </label>
          {hasHistory && (
            <span title={refreshLabel}>
              <Button
                type="button"
                variant="ghost"
                size={remaining > 0 && !running ? 'sm' : 'icon'}
                className={cn('gap-1.5', data?.stale && 'text-amber-600')}
                disabled={refreshDisabled}
                aria-label={refreshLabel}
                onClick={() => refresh.mutate()}
              >
                {running ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {!running && remaining > 0 && (
                  <span className="font-mono text-xs tabular">{countdown}</span>
                )}
              </Button>
            </span>
          )}
          <Popover open={infoOpen} onOpenChange={setInfoOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
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
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-2">
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
          aria-live="polite"
        >
          {hasHistory && (
            <>
              <span className="inline-flex items-center gap-1.5 text-ink-3">
                <span
                  className="w-4 border-t-2 border-pos"
                  aria-hidden="true"
                />
                Portfel
              </span>
              {showContribution && (
                <span className="inline-flex items-center gap-1.5 text-ink-3">
                  <span
                    className="w-4 border-t-2 border-blue-500"
                    aria-hidden="true"
                  />
                  Wkład własny
                </span>
              )}
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
              className="rounded-sm py-1 text-amber-600 hover:underline"
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
          />
        ) : (
          <div className="flex min-h-24 items-center justify-center py-5">
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}
