import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/api/auth'
import { apiRequest } from '@/api/client'
import { generateSeries, MOCK_PERFORMANCE } from '@/mocks/portfolio'
import type {
  CashOperationInput,
  DepositOperationInput,
  Operation,
  PortfolioPoint,
  PortfolioDashboard,
  PortfolioStatistics,
  RangeKey,
} from '@/types/portfolio'

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
  useQuery({
    queryKey: ['portfolio', 'mock-performance', range],
    queryFn: () => ({
      series: generateSeries(range),
      performance: MOCK_PERFORMANCE[range],
    }),
    staleTime: Infinity,
  })

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
