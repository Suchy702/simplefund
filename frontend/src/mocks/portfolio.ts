import type {
  Holding,
  Operation,
  Allocation,
  PortfolioKpi,
  RangeKey,
  FxRates,
} from '@/types/portfolio';

export const MOCK_FX: FxRates = { USD_PLN: 4.05 };

export const MOCK_KPI: PortfolioKpi = {
  totalContrib: 127483.49,
  totalValue: 124960.96,
  balance: -2522.54,
  roi: -1.98,
  cagr: -1.36,
  syncedMinutesAgo: 8,
  asOfDate: '25 kwi 2026',
};

export const MOCK_HOLDINGS: Holding[] = [
  {
    ticker: 'ATAL',
    name: 'ATAL SA',
    class: 'Akcje',
    qty: 5.0,
    currency: 'PLN',
    price: 59.5,
    cost: 829.0,
    value: 297.5,
    change: -531.5,
    changePct: -64.11,
    color: 'oklch(62% 0.13 240)',
  },
  {
    ticker: 'DUAL',
    name: 'DUALITY SA',
    class: 'Akcje',
    qty: 5.0,
    currency: 'PLN',
    price: 0.76,
    cost: 25.0,
    value: 3.8,
    change: -21.2,
    changePct: -84.8,
    color: 'oklch(60% 0.13 300)',
  },
  {
    ticker: 'EIMI',
    name: 'iShares Core EM',
    class: 'Akcje',
    qty: 47.37,
    currency: 'USD',
    price: 51.96,
    cost: 6646.0,
    value: 8918.18,
    change: 2272.18,
    changePct: 34.19,
    color: 'oklch(58% 0.14 150)',
  },
  {
    ticker: 'LPP',
    name: 'LPP SA',
    class: 'Akcje',
    qty: 3.3,
    currency: 'PLN',
    price: 22620,
    cost: 59400.0,
    value: 74646.0,
    change: 15246.0,
    changePct: 25.67,
    color: 'oklch(72% 0.16 65)',
  },
  {
    ticker: 'IWDA',
    name: 'iShares Core MSCI World',
    class: 'Akcje',
    qty: 18.73,
    currency: 'USD',
    price: 136.64,
    cost: 7428.89,
    value: 9270.68,
    change: 1841.78,
    changePct: 24.79,
    color: 'oklch(65% 0.13 200)',
  },
  {
    ticker: 'LOK',
    name: 'Lokata 5.00% (8.06.2021)',
    class: 'Lokata',
    qty: 1,
    currency: 'PLN',
    price: null,
    cost: 1000.0,
    value: 1268.71,
    change: 268.71,
    changePct: 26.87,
    color: 'oklch(60% 0.13 30)',
  },
];

export const MOCK_ALLOCATION: Allocation[] = [
  { name: 'Akcje', pct: 74.7, color: 'var(--cat-1)' },
  { name: 'Lokata', pct: 17.3, color: 'var(--cat-2)' },
  { name: 'Depozyt', pct: 8.0, color: 'var(--cat-3)' },
];

export const MOCK_OPERATIONS: Operation[] = [
  { type: 'Zakup', kind: 'Akcje', name: 'ATAL SA', qty: 5.0, price: 165.8, value: 829.0, currency: 'PLN', date: '16.11.2025' },
  { type: 'Zakup', kind: 'Akcje', name: 'DUALITY SA', qty: 5.0, price: 5.0, value: 25.0, currency: 'PLN', date: '22.11.2025' },
  { type: 'Zakup', kind: 'ETF', name: 'EIMI.L', qty: 0.47, price: 125.66, value: 58.9, currency: 'USD', date: '24.01.2025' },
  { type: 'Zakup', kind: 'Akcje', name: 'LPP SA', qty: 1.0, price: 15000, value: 15000.0, currency: 'PLN', date: '8.12.2025' },
  { type: 'Zakup', kind: 'ETF', name: 'EIMI.L', qty: 18.0, price: 159.02, value: 2862.36, currency: 'USD', date: '10.10.2025' },
  { type: 'Zakup', kind: 'ETF', name: 'IWDA.L', qty: 0.4, price: 400.31, value: 165.24, currency: 'USD', date: '24.01.2025' },
  { type: 'Sprzedaż', kind: 'Akcje', name: 'PKN ORLEN', qty: 12.0, price: 78.4, value: 940.8, currency: 'PLN', date: '04.11.2025' },
  { type: 'Zakup', kind: 'Lokata', name: 'Lokata 5.00%', qty: 1, price: 1000, value: 1000.0, currency: 'PLN', date: '08.06.2021' },
];

export function generateSeries(rangeKey: RangeKey): number[] {
  const target = MOCK_KPI.totalValue;
  const seedConfig: Record<RangeKey, { points: number; startPct: number; vol: number }> = {
    '1M': { points: 30, startPct: 0.985, vol: 0.006 },
    '3M': { points: 65, startPct: 0.95, vol: 0.009 },
    '6M': { points: 130, startPct: 0.92, vol: 0.012 },
    '1R': { points: 250, startPct: 0.86, vol: 0.015 },
    MAX: { points: 380, startPct: 0.42, vol: 0.022 },
  };
  const cfg = seedConfig[rangeKey];
  const start = target * cfg.startPct;
  let seed = ({ '1M': 3, '3M': 7, '6M': 11, '1R': 17, MAX: 23 } as Record<RangeKey, number>)[rangeKey];
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const pts: number[] = [];
  let v = start;
  const drift = (target - start) / cfg.points;
  for (let i = 0; i < cfg.points; i++) {
    const noise = (rand() - 0.45) * v * cfg.vol;
    v = v + drift + noise;
    pts.push(v);
  }
  pts[pts.length - 1] = target;
  return pts;
}
