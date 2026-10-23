export type RangeKey = '1M' | '3M' | '6M' | '1R' | 'MAX'
export type AssetClass =
  'Akcje' | 'Lokata' | 'Depozyt' | 'Gotówka' | 'Obligacje'
export const CURRENCIES = ['PLN', 'USD', 'EUR', 'GBP', 'CHF'] as const
export type Currency = (typeof CURRENCIES)[number]
export const TRADE_OPERATION_TYPES = ['buy', 'sell'] as const
export const CASH_OPERATION_TYPES = ['deposit', 'withdrawal'] as const
export type TradeOperationType = (typeof TRADE_OPERATION_TYPES)[number]
export type OperationType =
  TradeOperationType | (typeof CASH_OPERATION_TYPES)[number]
export const OPERATION_LABELS: Record<OperationType, string> = {
  buy: 'Zakup',
  sell: 'Sprzedaż',
  deposit: 'Wpłata',
  withdrawal: 'Wypłata',
}
export type OperationKind = AssetClass | 'ETF'

export interface Holding {
  id: string
  ticker: string
  name: string
  class: AssetClass
  qty: number
  currency: Currency
  price: number | null
  cost: number | null
  value: number | null
  change: number | null
  changePct: number | null
  color: string
}

export interface Operation {
  id: string
  type: OperationType
  kind: OperationKind
  name: string
  qty: number | null
  price: number | null
  value: number | null
  currency: Currency
  date: string
}

export interface AllocationSegment {
  name: string
  pct: number
  color: string
}

export interface Allocation {
  outer: AllocationSegment[]
  inner: AllocationSegment[]
  unvaluedCount: number
}

export interface PortfolioKpi {
  totalContrib: number
  totalValue: number
  balance: number
  roi: number
  cagr: number
  syncedMinutesAgo: number
  asOfDate: string
}

export interface CashOperationInput {
  operationType: (typeof CASH_OPERATION_TYPES)[number]
  value: string
  currency: Currency
  date: string
}

export interface PortfolioPoint {
  date: string
  value: number
}

export interface DepositOperationInput {
  value: string
  currency: Currency
  interestRate: string
  startDate: string
  maturityDate: string
}
