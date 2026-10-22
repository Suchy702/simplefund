export type RangeKey = '1M' | '3M' | '6M' | '1R' | 'MAX'
export type AssetClass = 'Akcje' | 'Lokata' | 'Depozyt'
export const CURRENCIES = ['PLN', 'USD', 'EUR'] as const
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
export type OperationKind = 'Akcje' | 'ETF' | 'Lokata' | 'Depozyt'

export interface Holding {
  ticker: string
  name: string
  class: AssetClass
  qty: number
  currency: Currency
  price: number | null
  cost: number
  value: number
  change: number
  changePct: number
  color: string
}

export interface Operation {
  type: OperationType
  kind: OperationKind
  name: string
  qty: number
  price: number
  value: number
  currency: Currency
  date: string
}

export interface Allocation {
  name: string
  pct: number
  color: string
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

export interface FxRates {
  USD_PLN: number
}

export interface PortfolioPoint {
  date: string
  value: number
}
