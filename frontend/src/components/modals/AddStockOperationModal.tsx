import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ChevronDown, TrendingUp } from 'lucide-react'
import { CryptoIcon } from '@/components/CryptoIcon'

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
      : instrument.quoteType === 'CRYPTOCURRENCY'
        ? 'Kryptowaluta'
        : (instrument.quoteType ?? 'Typ niedostępny'),
  ].join(' · ')

interface AddStockOperationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetType?: 'stocks' | 'crypto'
}

export const AddStockOperationModal = ({
  open,
  onOpenChange,
  assetType = 'stocks',
}: AddStockOperationModalProps) => {
  const isCrypto = assetType === 'crypto'
  const Icon = isCrypto ? CryptoIcon : TrendingUp
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selected, setSelected] = useState<StockInstrument | null>(null)
  const priceEditedManually = useRef(false)
  const mutation = useAddStockOperation(assetType)
  const held = useHeldStocks(open, assetType)
  const search = useStockSearch(debouncedQuery, open && pickerOpen, assetType)
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
    open && selected !== null,
    assetType
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
    setPickerOpen(false)
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
    <ul className="space-y-1" aria-label="Instrumenty">
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
              setPickerOpen(false)
              setQuery('')
              setDebouncedQuery('')
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
          <DialogTitle className="flex items-center gap-2">
            <Icon size={20} className="shrink-0" aria-hidden="true" />
            {isCrypto ? 'Kryptowaluty' : 'Akcje i ETF-y'}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 flex min-h-0 flex-col gap-4 overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <fieldset disabled={mutation.isPending} className="contents">
            <input type="hidden" {...register('ticker')} />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${assetType}-instrument`}
                className="text-13 font-medium"
              >
                Instrument
              </label>
              <Popover modal open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id={`${assetType}-instrument`}
                    type="button"
                    variant="outline"
                    disabled={mutation.isPending}
                    className="h-14 w-full justify-between gap-2 text-left font-normal"
                    aria-invalid={Boolean(errors.ticker)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-13 font-medium">
                        {selected?.name ?? 'Wybierz instrument'}
                      </span>
                      <span className="block truncate text-12 text-ink-3">
                        {selected
                          ? instrumentDetails(selected)
                          : 'Wyszukaj lub wybierz z portfela'}
                      </span>
                    </span>
                    <ChevronDown size={16} className="shrink-0 text-ink-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="flex max-h-[min(360px,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] flex-col gap-2 overflow-hidden p-2"
                >
                  <Input
                    id={`${assetType}-search`}
                    aria-label="Wyszukaj instrument"
                    className="shrink-0"
                    value={query}
                    maxLength={100}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={
                      isCrypto
                        ? 'Bitcoin lub BTC-USD'
                        : 'Nazwa lub ticker, np. ZAB.WA'
                    }
                    autoComplete="off"
                  />
                  <div
                    className="min-h-0 overflow-y-auto overscroll-contain p-1"
                    aria-live="polite"
                    aria-busy={searching && waiting}
                  >
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
                </PopoverContent>
              </Popover>
              {errors.ticker && (
                <p className="text-12 text-destructive">
                  {errors.ticker.message}
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
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${assetType}-date`}
                className="text-13 font-medium"
              >
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
                    id={`${assetType}-date`}
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
            <FloatInput
              id={`${assetType}-volume`}
              label="Liczba jednostek"
              min="0.00000001"
              step="0.00000001"
              error={errors.volume?.message}
              {...register('volume')}
            />
            <div className="flex flex-col gap-1.5">
              <FloatInput
                id={`${assetType}-price`}
                label={
                  selected?.currency
                    ? `Cena jednostkowa (${selected.currency})`
                    : 'Cena jednostkowa'
                }
                min={isCrypto ? '0.000000000001' : '0.0001'}
                step={isCrypto ? '0.000000000001' : '0.0001'}
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
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
