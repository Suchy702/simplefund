export type RangeKey = '1M' | '3M' | '6M' | '1R' | 'MAX'
export type AssetClass =
  | 'Akcje'
  | 'Lokata'
  | 'Depozyt'
  | 'Gotówka'
  | 'Obligacje skarbowe'
  | 'Kruszce'
  | 'Kryptowaluty'
export const CURRENCIES = ['PLN', 'USD', 'EUR', 'GBP', 'CHF'] as const
export type Currency = (typeof CURRENCIES)[number]
export const TRADE_OPERATION_TYPES = ['buy', 'sell'] as const
export const CASH_OPERATION_TYPES = ['deposit', 'withdrawal'] as const
export type TradeOperationType = (typeof TRADE_OPERATION_TYPES)[number]
export type OperationType =
  TradeOperationType | (typeof CASH_OPERATION_TYPES)[number] | 'import'
export const OPERATION_LABELS: Record<OperationType, string> = {
  buy: 'Zakup',
  sell: 'Sprzedaż',
  deposit: 'Wpłata',
  withdrawal: 'Wypłata',
  import: 'Import XTB',
}
export type OperationKind = AssetClass | 'ETF' | 'XTB'

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
  priceCurrency: Currency | null
  exchangeRate: number | null
  exchangeRateDate: string | null
  quantityUnit?: 'g' | null
  priceDate?: string | null
  priceSource?: string | null
  valuationNote?: string | null
  accruedInterest?: number | null
  paidInterest?: number | null
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
  exchangeRate: number | null
  exchangeRateDate: string | null
  valuePln: number | null
  quantityUnit?: 'g' | null
  sourceLabel?: string | null
  operationCount?: number | null
  valueDescription?: string | null
}

export interface MetalInstrument {
  metal: 'gold' | 'silver' | 'platinum' | 'palladium'
  name: string
  yahooSymbol: string
  quantityUnit: 'g'
}

export interface MetalOperationInput {
  metal: MetalInstrument['metal']
  operationType: TradeOperationType
  grams: string
  pricePerGram: string
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
  totalContrib: number | null
  totalValue: number | null
  balance: number | null
  roi: number | null
  xirr: number | null
  unvaluedCount?: number
  syncedMinutesAgo?: number | null
  asOfDate: string
}

export interface PerformanceStatistics {
  peak: number
  trough: number
  peakDate: string
  troughDate: string
  stdPct: number | null
  maxDd: number
  maxDdPln: number
  change: number
  changePct: number | null
}

export interface PortfolioStatistics {
  range: RangeKey
  kpi: PortfolioKpi
  series: { date: string; value: number | null }[]
  performance: PerformanceStatistics | null
}

export interface PortfolioDashboard {
  kpi: PortfolioKpi
  holdings: Holding[]
  allocation: Allocation
  operations: Operation[]
}

export interface HistoryPoint {
  date: string
  value: number | null
  contribution: number | null
  dailyReturn: number | null
}

export interface PortfolioHistory {
  status: 'idle' | 'running' | 'ready' | 'error'
  calculatedAt: string | null
  nextCalculationAt: string | null
  serverTime: string
  stale: boolean
  error: string | null
  warnings: string[]
  range: RangeKey
  series: HistoryPoint[]
  performance: PerformanceStatistics | null
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

export const BOND_FAMILIES = [
  'ROD',
  'ROS',
  'COI',
  'EDO',
  'TOS',
  'DOR',
  'ROR',
  'OTS',
] as const
export type BondFamily = (typeof BOND_FAMILIES)[number]

export interface BondSeriesOption {
  seriesCode: string
  family: BondFamily
  saleStart: string
  saleEnd: string
  termMonths: number
  pricePerUnit: number
  initialRatePct: number | null
}

export interface BondOperationInput {
  seriesCode: string
  quantity: number
  date: string
}

export interface StockInstrument {
  ticker: string
  name: string
  exchange: string | null
  currency: string | null
  quoteType: string | null
  canTransact: boolean
  unavailableReason: string | null
}

export interface StockOperationInput {
  ticker: string
  operationType: TradeOperationType
  date: string
  volume: string
  pricePerUnit: string
}

export interface StockPriceSuggestion {
  ticker: string
  currency: string
  price: string
  priceDate: string
  requestedDate: string
}
