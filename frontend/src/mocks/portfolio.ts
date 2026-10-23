import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  subMonths,
} from 'date-fns'
import { pl } from 'date-fns/locale'
import type {
  PortfolioKpi,
  RangeKey,
  PortfolioPoint,
  PerformanceStatistics,
} from '@/types/portfolio'

export const MOCK_AS_OF_DATE = '2026-04-25'

export const MOCK_KPI = {
  totalContrib: 127483.49,
  totalValue: 124960.96,
  balance: -2522.54,
  roi: -1.98,
  xirr: -1.36,
  syncedMinutesAgo: 8,
  asOfDate: format(parseISO(MOCK_AS_OF_DATE), 'd MMM yyyy', { locale: pl }),
} satisfies PortfolioKpi

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

// Fixed presentation fixtures for the generated demo series; no live valuations.
export const MOCK_PERFORMANCE = {
  '1M': {
    peak: 126836.9883188763,
    trough: 122951.64525902117,
    peakDate: '2026-04-23',
    troughDate: '2026-03-26',
    stdPct: 0.9433619416329062,
    maxDd: -0.014790861433573646,
    maxDdPln: -1876.0283188762987,
    change: 1899.8673533998517,
    changePct: 1.5438407969087213,
  },
  '3M': {
    peak: 125060.1765662738,
    trough: 118624.15209969024,
    peakDate: '2026-04-24',
    troughDate: '2026-02-02',
    stdPct: 1.5964802583744993,
    maxDd: -0.007825239956046297,
    maxDdPln: -978.6258905766106,
    change: 6108.744194864776,
    changePct: 5.139781495433286,
  },
  '6M': {
    peak: 137335.0497092299,
    trough: 115252.57608755224,
    peakDate: '2026-04-18',
    troughDate: '2025-10-31',
    stdPct: 5.253664772521115,
    maxDd: -0.09010146889252751,
    maxDdPln: -12374.089709229898,
    change: 9644.20587897922,
    changePct: 8.363230436453296,
  },
  '1R': {
    peak: 140788.432738679,
    trough: 108027.5396858041,
    peakDate: '2026-04-24',
    troughDate: '2025-05-24',
    stdPct: 8.39216027302494,
    maxDd: -0.11242026373044983,
    maxDdPln: -15827.47273867899,
    change: 16716.69581322222,
    changePct: 15.443493416313686,
  },
  MAX: {
    peak: 163253.56039965875,
    trough: 52302.93600000863,
    peakDate: '2026-04-15',
    troughDate: '2021-04-25',
    stdPct: 28.854317072875034,
    maxDd: -0.2345590522247427,
    maxDdPln: -38292.60039965874,
    change: 72658.02399999138,
    changePct: 138.91767758502004,
  },
} satisfies Record<RangeKey, PerformanceStatistics>
