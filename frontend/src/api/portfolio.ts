import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/api/auth'
import { apiRequest } from '@/api/client'
import type {
  Allocation,
  CashOperationInput,
  DepositOperationInput,
  Holding,
  Operation,
  PortfolioPoint,
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
  const query = usePortfolioStatistics('1R')
  return { ...query, data: query.data?.kpi }
}

export const useHoldings = () => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['portfolio', userId, 'holdings'],
    queryFn: ({ signal }) =>
      apiRequest<Holding[]>('/portfolio/holdings', userId!, { signal }),
    enabled: Boolean(userId),
  })
}

export const useAllocation = () => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['portfolio', userId, 'allocation'],
    queryFn: ({ signal }) =>
      apiRequest<Allocation>('/portfolio/allocation', userId!, { signal }),
    enabled: Boolean(userId),
  })
}

export const useOperations = () => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['portfolio', userId, 'operations'],
    queryFn: ({ signal }) =>
      apiRequest<Operation[]>('/transactions', userId!, { signal }),
    enabled: Boolean(userId),
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['portfolio', userId] }),
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['portfolio', userId] }),
  })
}

export const usePortfolioSeries = (range: RangeKey) => {
  const query = usePortfolioStatistics(range)
  const series = query.data?.series
  // Do not connect chart points across dates with unavailable valuations.
  const data: PortfolioPoint[] | undefined = series
    ? series.every((point): point is PortfolioPoint => point.value !== null)
      ? series
      : []
    : undefined
  return { ...query, data, change: query.data?.performance?.change }
}
