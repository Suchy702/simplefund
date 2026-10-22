import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  subMonths,
} from 'date-fns'
import { pl } from 'date-fns/locale'
import type {
  Allocation,
  PortfolioKpi,
  RangeKey,
  PortfolioPoint,
} from '@/types/portfolio'

export const MOCK_AS_OF_DATE = '2026-04-25'

export const MOCK_KPI: PortfolioKpi = {
  totalContrib: 127483.49,
  totalValue: 124960.96,
  balance: -2522.54,
  roi: -1.98,
  cagr: -1.36,
  syncedMinutesAgo: 8,
  asOfDate: format(parseISO(MOCK_AS_OF_DATE), 'd MMM yyyy', { locale: pl }),
}

export const MOCK_ALLOCATION: Allocation[] = [
  { name: 'Akcje', pct: 74.7, color: 'var(--cat-1)' },
  { name: 'Lokata', pct: 17.3, color: 'var(--cat-2)' },
  { name: 'Depozyt', pct: 8.0, color: 'var(--cat-3)' },
]

export function generateSeries(rangeKey: RangeKey): PortfolioPoint[] {
  const target = MOCK_KPI.totalValue
  const seedConfig: Record<
    RangeKey,
    { points: number; startPct: number; vol: number }
  > = {
    '1M': { points: 30, startPct: 0.985, vol: 0.006 },
    '3M': { points: 65, startPct: 0.95, vol: 0.009 },
    '6M': { points: 130, startPct: 0.92, vol: 0.012 },
    '1R': { points: 250, startPct: 0.86, vol: 0.015 },
    MAX: { points: 380, startPct: 0.42, vol: 0.022 },
  }
  const cfg = seedConfig[rangeKey]
  const start = target * cfg.startPct
  let seed = (
    { '1M': 3, '3M': 7, '6M': 11, '1R': 17, MAX: 23 } as Record<
      RangeKey,
      number
    >
  )[rangeKey]
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const pts: number[] = []
  let v = start
  const drift = (target - start) / cfg.points
  for (let i = 0; i < cfg.points; i++) {
    const noise = (rand() - 0.45) * v * cfg.vol
    v = v + drift + noise
    pts.push(v)
  }
  pts[pts.length - 1] = target
  const months: Record<RangeKey, number> = {
    '1M': 1,
    '3M': 3,
    '6M': 6,
    '1R': 12,
    MAX: 60,
  }
  const end = parseISO(MOCK_AS_OF_DATE)
  const startDate = subMonths(end, months[rangeKey])
  const days = differenceInCalendarDays(end, startDate)
  return pts.map((value, index) => ({
    date: format(
      addDays(startDate, Math.round((index * days) / (pts.length - 1))),
      'yyyy-MM-dd'
    ),
    value,
  }))
}
