import { supabase } from '@/lib/supabase'

const apiUrl = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '')

export async function apiRequest<T>(
  path: string,
  userId: string,
  options: RequestInit = {}
): Promise<T> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session || data.session.user.id !== userId) {
    throw new Error('Sesja wygasła. Zaloguj się ponownie.')
  }

  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
      },
    })
  } catch {
    throw new Error('Nie udało się połączyć z serwerem.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'Sesja wygasła. Zaloguj się ponownie.'
        : typeof detail === 'string'
          ? detail
          : response.status === 422
            ? 'Sprawdź kwotę, walutę i datę operacji.'
            : 'Nie udało się pobrać lub zapisać danych.'
    )
  }
  if (response.status === 204) return undefined as T
  return response.json()
}
