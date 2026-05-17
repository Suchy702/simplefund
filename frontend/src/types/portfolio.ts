export type RangeKey = '1M' | '3M' | '6M' | '1R' | 'MAX';
export type AssetClass = 'Akcje' | 'Lokata' | 'Depozyt';
export type Currency = 'PLN' | 'USD';
export type OperationType = 'Zakup' | 'Sprzedaż';
export type OperationKind = 'Akcje' | 'ETF' | 'Lokata' | 'Depozyt';

export interface Holding {
  ticker: string;
  name: string;
  class: AssetClass;
  qty: number;
  currency: Currency;
  price: number | null;
  cost: number;
  value: number;
  change: number;
  changePct: number;
  color: string;
}

export interface Operation {
  type: OperationType;
  kind: OperationKind | string;
  name: string;
  qty: number;
  price: number;
  value: number;
  currency: Currency;
  date: string;
}

export interface Allocation {
  name: string;
  pct: number;
  color: string;
}

export interface PortfolioKpi {
  totalContrib: number;
  totalValue: number;
  balance: number;
  roi: number;
  cagr: number;
  syncedMinutesAgo: number;
  asOfDate: string;
}

export interface FxRates {
  USD_PLN: number;
}
