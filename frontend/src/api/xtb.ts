import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useSession } from '@/api/auth'
import { apiRequest } from '@/api/client'
import type { Currency, StockInstrument } from '@/types/portfolio'

export interface XtbChoice {
  mode: 'yahoo' | 'skip' | 'unresolved'
  ticker?: string | null
}

export interface XtbInstrument {
  sourceTicker: string
  name: string
  category: string
  choice: XtbChoice
  selected: StockInstrument | null
  candidates: StockInstrument[]
  status: 'automatic' | 'saved' | 'changed' | 'unresolved'
  warning: string | null
  issues: string[]
}

export interface XtbPreview {
  importId: string
  revision: number
  accounts: {
    account: string
    filename: string
    currency: Currency | null
    isIke: boolean
    operationCount: number
  }[]
  instruments: XtbInstrument[]
  warnings: string[]
  errors: string[]
  summary: {
    newOperations: number
    duplicates: number
    skippedTrades: number
    cashOperations: number
  }
  canImport: boolean
}

export interface XtbResult {
  imported: number
  duplicates: number
  skippedTrades: number
}

export const useXtbImport = () => {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const userId = session?.user.id
  const requireUser = () => {
    if (!userId) throw new Error('Zaloguj się ponownie.')
    return userId
  }
  const analyze = useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData()
      files.forEach((file) => form.append('files', file))
      return apiRequest<XtbPreview>('/imports/xtb/preview', requireUser(), {
        method: 'POST',
        body: form,
      })
    },
  })
  const resolve = useMutation({
    mutationFn: ({
      preview,
      choices,
      currencies,
    }: {
      preview: XtbPreview
      choices: Record<string, XtbChoice>
      currencies: Record<string, Currency | ''>
    }) =>
      apiRequest<XtbPreview>(
        `/imports/xtb/preview/${preview.importId}`,
        requireUser(),
        {
          method: 'POST',
          body: JSON.stringify({
            choices,
            currencies,
            revision: preview.revision,
          }),
        }
      ),
  })
  const commit = useMutation({
    mutationFn: (preview: XtbPreview) =>
      apiRequest<XtbResult>('/imports/xtb/commit', requireUser(), {
        method: 'POST',
        body: JSON.stringify({
          importId: preview.importId,
          revision: preview.revision,
          confirmed: true,
        }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['portfolio', userId] }),
  })
  return { analyze, resolve, commit }
}
