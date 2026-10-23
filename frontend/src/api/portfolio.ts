import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/api/auth'
import { apiRequest } from '@/api/client'
import type {
  Allocation,
  CashOperationInput,
  DepositOperationInput,
  Holding,
  Operation,
  PortfolioKpi,
  PortfolioPoint,
  RangeKey,
} from '@/types/portfolio'
import { MOCK_KPI, generateSeries } from '@/mocks/portfolio'

const SIMULATED_DELAY_MS = 200

const delay = <T>(value: T, ms: number = SIMULATED_DELAY_MS): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

const fetchKpi = (): Promise<PortfolioKpi> => delay(MOCK_KPI)
const fetchSeries = (range: RangeKey): Promise<PortfolioPoint[]> =>
  delay(generateSeries(range))

export const usePortfolioKpi = () =>
  useQuery({ queryKey: ['portfolio', 'kpi'], queryFn: fetchKpi })

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

export const usePortfolioSeries = (range: RangeKey) =>
  useQuery({
    queryKey: ['portfolio', 'series', range],
    queryFn: () => fetchSeries(range),
  })
