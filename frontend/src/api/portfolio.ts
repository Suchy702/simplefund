import { useQuery } from '@tanstack/react-query'
import type {
  Allocation,
  FxRates,
  Holding,
  Operation,
  PortfolioKpi,
  RangeKey,
} from '@/types/portfolio'
import {
  MOCK_ALLOCATION,
  MOCK_FX,
  MOCK_HOLDINGS,
  MOCK_KPI,
  MOCK_OPERATIONS,
  generateSeries,
} from '@/mocks/portfolio'

const SIMULATED_DELAY_MS = 200

const delay = <T>(value: T, ms: number = SIMULATED_DELAY_MS): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

const fetchKpi = (): Promise<PortfolioKpi> => delay(MOCK_KPI)
const fetchHoldings = (): Promise<Holding[]> => delay(MOCK_HOLDINGS)
const fetchAllocation = (): Promise<Allocation[]> => delay(MOCK_ALLOCATION)
const fetchOperations = (): Promise<Operation[]> => delay(MOCK_OPERATIONS)
const fetchFxRates = (): Promise<FxRates> => delay(MOCK_FX)
const fetchSeries = (range: RangeKey): Promise<number[]> =>
  delay(generateSeries(range))

export const usePortfolioKpi = () =>
  useQuery({ queryKey: ['portfolio', 'kpi'], queryFn: fetchKpi })

export const useHoldings = () =>
  useQuery({ queryKey: ['portfolio', 'holdings'], queryFn: fetchHoldings })

export const useAllocation = () =>
  useQuery({ queryKey: ['portfolio', 'allocation'], queryFn: fetchAllocation })

export const useOperations = () =>
  useQuery({ queryKey: ['portfolio', 'operations'], queryFn: fetchOperations })

export const useFxRates = () =>
  useQuery({ queryKey: ['fx', 'rates'], queryFn: fetchFxRates })

export const usePortfolioSeries = (range: RangeKey) =>
  useQuery({
    queryKey: ['portfolio', 'series', range],
    queryFn: () => fetchSeries(range),
  })
