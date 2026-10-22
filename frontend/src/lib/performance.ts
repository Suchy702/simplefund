import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import type { PortfolioPoint } from '@/types/portfolio'

export const formatSeriesDate = (date: string): string =>
  format(parseISO(date), 'd MMM yyyy', { locale: pl })

export function calculatePerformanceStats(series: readonly PortfolioPoint[]) {
  if (series.length === 0) return null

  const values = series.map((point) => point.value)
  const peak = Math.max(...values)
  const trough = Math.min(...values)
  const peakDate = series[values.indexOf(peak)].date
  const troughDate = series[values.indexOf(trough)].date
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const stdPct = (Math.sqrt(variance) / mean) * 100

  let maxDd = 0
  let peakSoFar = values[0]
  for (const value of values) {
    if (value > peakSoFar) peakSoFar = value
    const dd = (value - peakSoFar) / peakSoFar
    if (dd < maxDd) maxDd = dd
  }
  const maxDdPln = maxDd * peak

  return { peak, trough, peakDate, troughDate, stdPct, maxDd, maxDdPln }
}
