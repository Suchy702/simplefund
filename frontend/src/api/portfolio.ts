import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/api/auth'
import { apiRequest } from '@/api/client'
import type {
  BondFamily,
  BondOperationInput,
  BondSeriesOption,
  CashOperationInput,
  DepositOperationInput,
  MetalInstrument,
  MetalOperationInput,
  Operation,
  PortfolioPoint,
  PortfolioDashboard,
  PortfolioStatistics,
  RangeKey,
  StockInstrument,
  StockOperationInput,
  StockPriceSuggestion,
} from '@/types/portfolio'

export const useBondSeries = (
  date: string,
  family: BondFamily,
  enabled: boolean
) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['bond-series', userId, date, family],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ date, family })
      return apiRequest<BondSeriesOption[]>(
        `/bonds/series?${params}`,
        userId!,
        { signal }
      )
    },
    enabled: enabled && Boolean(userId) && Boolean(date),
    staleTime: 5 * 60_000,
  })
}

export const useAddBondOperation = () => {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const userId = session?.user.id
  return useMutation({
    mutationFn: (data: BondOperationInput) => {
      if (!userId) throw new Error('Zaloguj się ponownie.')
      return apiRequest<Operation>('/transactions/bonds', userId, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['portfolio', userId] }),
  })
}

export const usePortfolioStatistics = (range: RangeKey) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['portfolio', userId, 'statistics', range],
    queryFn: ({ signal }) =>
      apiRequest<PortfolioStatistics>(
        `/portfolio/statistics?range=${range}`,
        userId!,
        { signal }
      ),
    enabled: Boolean(userId),
  })
}

export const usePortfolioKpi = () => {
  const query = usePortfolioDashboard()
  return { ...query, data: query.data?.kpi }
}

export const usePortfolioPerformance = (range: RangeKey) =>
  usePortfolioStatistics(range)

const usePortfolioDashboard = () => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['portfolio', userId, 'dashboard'],
    queryFn: ({ signal }) =>
      apiRequest<PortfolioDashboard>('/portfolio/dashboard', userId!, {
        signal,
      }),
    enabled: Boolean(userId),
  })
}

export const useMetals = (enabled: boolean) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['metals', userId],
    queryFn: ({ signal }) =>
      apiRequest<MetalInstrument[]>('/metals', userId!, { signal }),
    enabled: enabled && Boolean(userId),
    staleTime: Infinity,
  })
}

export const useAddMetalOperation = () => {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const userId = session?.user.id
  return useMutation({
    mutationFn: (data: MetalOperationInput) => {
      if (!userId) throw new Error('Zaloguj się ponownie.')
      return apiRequest<Operation>('/transactions/metals', userId, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['portfolio', userId] }),
  })
}

export const useHeldStocks = (
  enabled: boolean,
  assetType: 'stocks' | 'crypto' = 'stocks'
) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['portfolio', userId, 'held-stocks', assetType],
    queryFn: ({ signal }) =>
      apiRequest<StockInstrument[]>(`/${assetType}/held`, userId!, { signal }),
    enabled: enabled && Boolean(userId),
  })
}

export const useStockSearch = (
  query: string,
  enabled: boolean,
  assetType: 'stocks' | 'crypto' = 'stocks'
) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['stock-search', userId, query, assetType],
    queryFn: ({ signal }) =>
      apiRequest<StockInstrument[]>(
        `/${assetType}/search?q=${encodeURIComponent(query)}`,
        userId!,
        { signal }
      ),
    enabled: enabled && Boolean(userId) && query.length > 0,
    staleTime: 60_000,
    retry: false,
  })
}

export const useStockPriceSuggestion = (
  ticker: string,
  date: string,
  currency: string,
  enabled: boolean,
  assetType: 'stocks' | 'crypto' = 'stocks'
) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['stock-price', userId, ticker, date, currency, assetType],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ ticker, date, currency })
      return apiRequest<StockPriceSuggestion>(
        `/${assetType}/price?${params}`,
        userId!,
        { signal }
      )
    },
    enabled: enabled && Boolean(userId) && Boolean(ticker && currency && date),
    staleTime: 15 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export const useAddStockOperation = (
  assetType: 'stocks' | 'crypto' = 'stocks'
) => {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const userId = session?.user.id
  return useMutation({
    mutationFn: (data: StockOperationInput) => {
      if (!userId) throw new Error('Zaloguj się ponownie.')
      return apiRequest<Operation>(`/transactions/${assetType}`, userId, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['portfolio', userId] }),
  })
}

export const useHoldings = () => {
  const query = usePortfolioDashboard()
  return { ...query, data: query.data?.holdings }
}

export const useAllocation = () => {
  const query = usePortfolioDashboard()
  return { ...query, data: query.data?.allocation }
}

export const useOperations = () => {
  const query = usePortfolioDashboard()
  return { ...query, data: query.data?.operations }
}

export const useDeleteOperation = () => {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const userId = session?.user.id
  return useMutation({
    mutationFn: (transactionId: string) => {
      if (!userId) throw new Error('Zaloguj się ponownie.')
      return apiRequest<void>(`/transactions/${transactionId}`, userId, {
        method: 'DELETE',
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['portfolio', userId] }),
  })
}

export const useAddCashOperation = () => {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const userId = session?.user.id
  return useMutation({
    mutationFn: (data: CashOperationInput) => {
      if (!userId) throw new Error('Zaloguj się ponownie.')
      return apiRequest<Operation>('/transactions/cash', userId, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['portfolio', userId] })
    },
  })
}

export const useAddDepositOperation = () => {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const userId = session?.user.id
  return useMutation({
    mutationFn: (data: DepositOperationInput) => {
      if (!userId) throw new Error('Zaloguj się ponownie.')
      return apiRequest<Operation>('/transactions/deposit', userId, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['portfolio', userId] })
    },
  })
}

export const usePortfolioSeries = (range: RangeKey) => {
  const query = usePortfolioPerformance(range)
  const series = query.data?.series
  // Do not connect chart points across dates with unavailable valuations.
  const data: PortfolioPoint[] | undefined = series
    ? series.every((point): point is PortfolioPoint => point.value !== null)
      ? series
      : []
    : undefined
  return { ...query, data, change: query.data?.performance?.change }
}
