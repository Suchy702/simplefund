import type {
  Allocation,
  HistoryPoint,
  OperationType,
  PortfolioKpi,
} from '@/types/portfolio'

// Fixed, fictional presentation data. No user data or live portfolio calculations.
export const landingKpi = {
  totalValue: 128500,
  totalContrib: 115000,
  balance: 13500,
  roi: 11.74,
  xirr: 11.74,
  asOfDate: '2026-01-02',
} satisfies PortfolioKpi

export const landingAllocation: Allocation = {
  outer: [
    { name: 'Akcje', pct: 50, color: 'var(--cat-1)' },
    { name: 'Gotówka', pct: 5, color: 'var(--cat-3)' },
    { name: 'Obligacje skarbowe', pct: 30, color: 'var(--cat-4)' },
    { name: 'Kruszce', pct: 15, color: 'oklch(68% 0.13 90)' },
  ],
  inner: [
    { name: 'Vanguard FTSE All-World', pct: 50, color: 'var(--cat-1)' },
    { name: 'Gotówka PLN', pct: 5, color: 'var(--cat-3)' },
    { name: 'EDO0135', pct: 30, color: 'var(--cat-4)' },
    { name: 'Złoto', pct: 15, color: 'oklch(68% 0.13 90)' },
  ],
  unvaluedCount: 0,
}

export const landingDetailedAllocation: Allocation = {
  outer: landingAllocation.outer,
  inner: [
    { name: 'Vanguard FTSE All-World', pct: 28, color: 'var(--cat-1)' },
    {
      name: 'Apple',
      pct: 14,
      color: 'color-mix(in oklch, var(--cat-1), white 25%)',
    },
    {
      name: 'Microsoft',
      pct: 8,
      color: 'color-mix(in oklch, var(--cat-1), white 50%)',
    },
    { name: 'Gotówka PLN', pct: 3, color: 'var(--cat-3)' },
    {
      name: 'Gotówka EUR',
      pct: 2,
      color: 'color-mix(in oklch, var(--cat-3), white 30%)',
    },
    { name: 'EDO0135', pct: 18, color: 'var(--cat-4)' },
    {
      name: 'COI0129',
      pct: 12,
      color: 'color-mix(in oklch, var(--cat-4), white 30%)',
    },
    { name: 'Złoto', pct: 10, color: 'oklch(68% 0.13 90)' },
    {
      name: 'Srebro',
      pct: 5,
      color: 'color-mix(in oklch, oklch(68% 0.13 90), white 35%)',
    },
  ],
  unvaluedCount: 0,
}

export const landingHistory: HistoryPoint[] = [
  {
    date: '2025-01-02',
    value: 115000,
    contribution: 100000,
    dailyReturn: null,
  },
  {
    date: '2025-02-02',
    value: 117200,
    contribution: 100000,
    dailyReturn: null,
  },
  {
    date: '2025-03-02',
    value: 116300,
    contribution: 105000,
    dailyReturn: null,
  },
  {
    date: '2025-04-02',
    value: 112800,
    contribution: 105000,
    dailyReturn: null,
  },
  {
    date: '2025-05-02',
    value: 116600,
    contribution: 110000,
    dailyReturn: null,
  },
  {
    date: '2025-06-02',
    value: 119500,
    contribution: 110000,
    dailyReturn: null,
  },
  {
    date: '2025-07-02',
    value: 118400,
    contribution: 110000,
    dailyReturn: null,
  },
  {
    date: '2025-08-02',
    value: 122100,
    contribution: 115000,
    dailyReturn: null,
  },
  {
    date: '2025-09-02',
    value: 121300,
    contribution: 115000,
    dailyReturn: null,
  },
  {
    date: '2025-10-02',
    value: 124400,
    contribution: 115000,
    dailyReturn: null,
  },
  {
    date: '2025-11-02',
    value: 123600,
    contribution: 115000,
    dailyReturn: null,
  },
  {
    date: '2025-12-02',
    value: 126800,
    contribution: 115000,
    dailyReturn: null,
  },
  {
    date: '2026-01-02',
    value: 128500,
    contribution: 115000,
    dailyReturn: null,
  },
]

export const landingHoldings = [
  {
    ticker: 'VWCE.DE',
    name: 'Vanguard FTSE All-World',
    qty: 100,
    unit: 'szt.',
    cost: 55575,
    value: 64250,
    change: 8675,
    changePct: 15.61,
    color: 'var(--cat-1)',
  },
  {
    ticker: 'EDO0135',
    name: 'Obligacje skarbowe',
    qty: 350,
    unit: 'szt.',
    cost: 35000,
    value: 38550,
    change: 3550,
    changePct: 10.14,
    color: 'var(--cat-4)',
  },
  {
    ticker: 'ZŁOTO',
    name: 'Złoto',
    qty: 50,
    unit: 'g',
    cost: 18000,
    value: 19275,
    change: 1275,
    changePct: 7.08,
    color: 'oklch(68% 0.13 90)',
  },
  {
    ticker: 'PLN',
    name: 'Gotówka',
    qty: 6425,
    unit: 'PLN',
    cost: 6425,
    value: 6425,
    change: 0,
    changePct: 0,
    color: 'var(--cat-3)',
  },
]

export const landingOperations = [
  {
    type: 'buy',
    kind: 'ETF',
    name: 'VWCE.DE',
    qty: '100,00',
    value: '13 500,00',
    currency: 'EUR',
    date: '02.01.2025',
  },
  {
    type: 'buy',
    kind: 'Obligacje skarbowe',
    name: 'EDO0135',
    qty: '350,00',
    value: '35 000,00',
    currency: 'PLN',
    date: '02.01.2025',
  },
  {
    type: 'deposit',
    kind: 'Gotówka',
    name: 'PLN',
    qty: '6 425,00',
    value: '6 425,00',
    currency: 'PLN',
    date: '02.01.2025',
  },
] satisfies {
  type: OperationType
  kind: string
  name: string
  qty: string
  value: string
  currency: string
  date: string
}[]
