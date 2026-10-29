import { useQuery } from '@tanstack/react-query'

import { useSession } from '@/api/auth'
import { apiRequest } from '@/api/client'
import { supabase } from '@/lib/supabase'

export interface ConnectionCheck {
  status: 'ok' | 'error'
  detail: string
  checked_at: string
  response_time_ms: number | null
  source_url?: string
  rate_dates?: Record<string, string> | null
  rates?: Record<string, number> | null
  symbol?: string
  price?: number | null
  currency?: string | null
  price_date?: string | null
}

interface AdminConnections {
  backend: ConnectionCheck
  currency: ConnectionCheck
}

export const useProfileRole = () => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['auth', 'role', userId],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId!)
        .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(8_000)]))
        .maybeSingle()
      if (error) throw new Error('Nie udało się sprawdzić roli użytkownika.')
      return data?.role === 'admin' ? 'admin' : 'user'
    },
    enabled: Boolean(userId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  })
}

export const useSupabaseConnection = (enabled: boolean) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['admin', userId, 'supabase'],
    queryFn: async ({ signal }): Promise<ConnectionCheck> => {
      const started = performance.now()
      const { error, data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId!)
        .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(8_000)]))
        .single()
      return {
        status: error || !data ? 'error' : 'ok',
        detail:
          error || !data
            ? 'Nie udało się odczytać danych z bazy Supabase.'
            : 'Połączono z bazą Supabase. Odczyt profilu działa.',
        checked_at: new Date().toISOString(),
        response_time_ms: Math.round(performance.now() - started),
      }
    },
    enabled: enabled && Boolean(userId),
    staleTime: 0,
    retry: false,
  })
}

export const useBackendConnections = (enabled: boolean) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['admin', userId, 'connections'],
    queryFn: async ({ signal }) => {
      const started = performance.now()
      const data = await apiRequest<AdminConnections>(
        '/admin/connections',
        userId!,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) }
      )
      return {
        ...data,
        backend: {
          ...data.backend,
          response_time_ms: Math.round(performance.now() - started),
        },
      }
    },
    enabled: enabled && Boolean(userId),
    staleTime: 0,
    retry: false,
  })
}

export const useStockConnection = (enabled: boolean) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['admin', userId, 'stocks'],
    queryFn: ({ signal }) =>
      apiRequest<ConnectionCheck>('/admin/connections/stocks', userId!, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      }),
    enabled: enabled && Boolean(userId),
    staleTime: 0,
    retry: false,
  })
}

export const useCryptoConnection = (enabled: boolean) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['admin', userId, 'crypto'],
    queryFn: ({ signal }) =>
      apiRequest<ConnectionCheck>('/admin/connections/crypto', userId!, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      }),
    enabled: enabled && Boolean(userId),
    staleTime: 0,
    retry: false,
  })
}

export const useExternalConnection = (
  service: 'bonds' | 'nbp' | 'gus' | 'history-yahoo' | 'history-fx',
  enabled: boolean
) => {
  const { data: session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['admin', userId, 'sources', service],
    queryFn: ({ signal }) =>
      apiRequest<ConnectionCheck>(
        `/admin/connections/sources/${service}`,
        userId!,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) }
      ),
    enabled: enabled && Boolean(userId),
    staleTime: 0,
    retry: false,
  })
}
