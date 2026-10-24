import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'

import {
  useAddStockOperation,
  useHeldStocks,
  useStockPriceSuggestion,
  useStockSearch,
} from '@/api/portfolio'
import { BuySellSelect, FloatInput } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { StockInstrument } from '@/types/portfolio'

const schema = z.object({
  ticker: z.string().min(1, 'Wybierz instrument'),
  operationType: z.enum(['buy', 'sell']),
  volume: z.string().trim().min(1, 'Podaj liczbę jednostek'),
  pricePerUnit: z.string().trim().min(1, 'Podaj cenę jednostkową'),
  date: z.string().date('Podaj prawidłową datę'),
})

type FormValues = z.infer<typeof schema>

const defaults = (): FormValues => ({
  ticker: '',
  operationType: 'buy',
  volume: '',
  pricePerUnit: '',
  date: format(new Date(), 'yyyy-MM-dd'),
})

const instrumentDetails = (instrument: StockInstrument) =>
  [
    instrument.ticker,
    (instrument.exchange === 'WSE' ? 'GPW' : instrument.exchange) ??
      'Giełda niedostępna',
    instrument.currency ?? 'Waluta niedostępna',
    instrument.quoteType === 'EQUITY'
      ? 'Akcja'
      : (instrument.quoteType ?? 'Typ niedostępny'),
  ].join(' · ')

interface AddStockOperationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const AddStockOperationModal = ({
  open,
  onOpenChange,
}: AddStockOperationModalProps) => {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selected, setSelected] = useState<StockInstrument | null>(null)
  const priceEditedManually = useRef(false)
  const mutation = useAddStockOperation()
  const held = useHeldStocks(open)
  const search = useStockSearch(debouncedQuery, open && selected === null)
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })
  const transactionDate = watch('date')
  const priceSuggestion = useStockPriceSuggestion(
    selected?.ticker ?? '',
    transactionDate,
    selected?.currency ?? '',
    open && selected !== null
  )

  useEffect(() => {
    if (priceSuggestion.data && !priceEditedManually.current) {
      setValue('pricePerUnit', priceSuggestion.data.price, {
        shouldValidate: true,
      })
    }
  }, [priceSuggestion.data, setValue])

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      300
    )
    return () => window.clearTimeout(timeout)
  }, [query])

  const clear = () => {
    reset(defaults())
    setQuery('')
    setDebouncedQuery('')
    setSelected(null)
    priceEditedManually.current = false
    mutation.reset()
  }

  const handleClose = () => {
    if (mutation.isPending) return
    clear()
    onOpenChange(false)
  }

  const onSubmit = async (data: FormValues) => {
    if (mutation.isPending || !selected?.canTransact) return
    try {
      await mutation.mutateAsync(data)
      clear()
      onOpenChange(false)
    } catch {
      // Keep entered values and the selected instrument available for a retry.
    }
  }

  const renderInstruments = (instruments: StockInstrument[]) => (
    <ul
      className="max-h-52 space-y-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Instrumenty"
    >
      {instruments.map((instrument) => (
        <li key={instrument.ticker}>
          <button
            type="button"
            disabled={!instrument.canTransact}
            className="w-full rounded-sm border border-border p-2 text-left hover:bg-brand-soft focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              priceEditedManually.current = false
              setValue('pricePerUnit', '')
              setSelected(instrument)
              setValue('ticker', instrument.ticker, { shouldValidate: true })
            }}
          >
            <span className="block text-13 font-medium">{instrument.name}</span>
            <span className="block text-12 text-ink-3">
              {instrumentDetails(instrument)}
            </span>
            {instrument.unavailableReason && (
              <span className="block text-12 text-destructive">
                {instrument.unavailableReason}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )

  const searching = query.trim().length > 0
  const waiting = query.trim() !== debouncedQuery || search.isFetching

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-lg"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Dodaj operację — Akcje i ETF-y</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 flex min-h-0 flex-col gap-4 overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <fieldset disabled={mutation.isPending} className="contents">
            <input type="hidden" {...register('ticker')} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="stock-search" className="text-13 font-medium">
                Instrument
              </label>
              {selected ? (
                <div className="rounded-sm border border-border p-3">
                  <div className="text-13 font-medium">{selected.name}</div>
                  <div className="text-12 text-ink-3">
                    {instrumentDetails(selected)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    onClick={() => {
                      priceEditedManually.current = false
                      setValue('pricePerUnit', '')
                      setSelected(null)
                      setValue('ticker', '')
                      mutation.reset()
                    }}
                  >
                    Zmień instrument
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    id="stock-search"
                    value={query}
                    maxLength={100}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Wpisz nazwę lub ticker, np. Żabka lub ZAB.WA"
                    autoComplete="off"
                  />
                  <div aria-live="polite" aria-busy={searching && waiting}>
                    {searching ? (
                      waiting ? (
                        <p className="text-12 text-ink-3">Wyszukiwanie…</p>
                      ) : search.isError ? (
                        <div role="alert" className="text-12 text-destructive">
                          {search.error.message}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void search.refetch()}
                          >
                            Spróbuj ponownie
                          </Button>
                        </div>
                      ) : search.data?.length ? (
                        renderInstruments(search.data)
                      ) : (
                        <p className="text-12 text-ink-3">
                          Nie znaleziono instrumentów.
                        </p>
                      )
                    ) : (
                      <>
                        <p className="mb-2 text-12 text-ink-3">
                          Instrumenty w Twoim portfelu
                        </p>
                        {held.isPending ? (
                          <p className="text-12 text-ink-3">Ładowanie…</p>
                        ) : held.isError ? (
                          <p role="alert" className="text-12 text-destructive">
                            {held.error.message}
                          </p>
                        ) : held.data?.length ? (
                          renderInstruments(held.data)
                        ) : (
                          <p className="text-12 text-ink-3">
                            Nie masz jeszcze instrumentów. Wyszukaj pierwszy.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
              {errors.ticker && (
                <p className="text-12 text-destructive">
                  {errors.ticker.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="stock-date" className="text-13 font-medium">
                Data transakcji
              </label>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    onChange={(value) => {
                      if (value === field.value) return
                      priceEditedManually.current = false
                      setValue('pricePerUnit', '')
                      field.onChange(value)
                    }}
                    id="stock-date"
                    max={format(new Date(), 'yyyy-MM-dd')}
                    disabled={mutation.isPending || selected === null}
                    invalid={Boolean(errors.date)}
                  />
                )}
              />
              {errors.date && (
                <p className="text-12 text-destructive">
                  {errors.date.message}
                </p>
              )}
            </div>
            <Controller
              name="operationType"
              control={control}
              render={({ field }) => (
                <BuySellSelect
                  label="Typ operacji"
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            />
            <FloatInput
              id="stock-volume"
              label="Liczba jednostek"
              min="0.00000001"
              step="0.00000001"
              error={errors.volume?.message}
              {...register('volume')}
            />
            <div className="flex flex-col gap-1.5">
              <FloatInput
                id="stock-price"
                label={
                  selected?.currency
                    ? `Cena jednostkowa (${selected.currency})`
                    : 'Cena jednostkowa'
                }
                min="0.0001"
                step="0.0001"
                error={errors.pricePerUnit?.message}
                {...register('pricePerUnit', {
                  onChange: () => {
                    priceEditedManually.current = true
                  },
                })}
              />
              <div aria-live="polite">
                {selected && priceSuggestion.isFetching ? (
                  <p className="text-12 text-ink-3">Pobieranie ceny Yahoo…</p>
                ) : selected && priceSuggestion.isError ? (
                  <p className="text-12 text-ink-3">
                    {priceSuggestion.error.message}
                  </p>
                ) : null}
              </div>
            </div>
            {mutation.isError && (
              <p role="alert" className="text-13 text-destructive">
                {mutation.error.message}
              </p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Anuluj
              </Button>
              <Button
                type="submit"
                variant="brand"
                disabled={!selected?.canTransact}
              >
                {mutation.isPending ? 'Zapisywanie…' : 'Dodaj'}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
