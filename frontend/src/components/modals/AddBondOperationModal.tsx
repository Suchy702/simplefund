import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'

import { useAddBondOperation, useBondSeries } from '@/api/portfolio'
import { BOND_FAMILIES } from '@/types/portfolio'
import { fmtNumber } from '@/lib/formatters'
import { FloatInput } from '@/components/forms'
import { PolishEagleIcon } from '@/components/PolishEagleIcon'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const schema = z.object({
  date: z
    .string()
    .date('Podaj prawidłową datę zakupu')
    .refine(
      (value) => value <= format(new Date(), 'yyyy-MM-dd'),
      'Data zakupu nie może być w przyszłości'
    ),
  family: z.enum(BOND_FAMILIES),
  quantity: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,9}$/, 'Podaj dodatnią, całkowitą liczbę sztuk')
    .refine(
      (value) => Number(value) <= 2_147_483_647,
      'Liczba sztuk jest zbyt duża'
    ),
})

type FormValues = z.infer<typeof schema>

interface AddBondOperationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const defaults = (): FormValues => ({
  date: format(new Date(), 'yyyy-MM-dd'),
  family: 'EDO',
  quantity: '1',
})

export const AddBondOperationModal = ({
  open,
  onOpenChange,
}: AddBondOperationModalProps) => {
  const mutation = useAddBondOperation()
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })
  const date = watch('date')
  const family = watch('family')
  const series = useBondSeries(date, family, open)
  const selected = series.data?.length === 1 ? series.data[0] : undefined

  const handleClose = () => {
    if (mutation.isPending) return
    reset(defaults())
    mutation.reset()
    onOpenChange(false)
  }

  const onSubmit = async (data: FormValues) => {
    if (mutation.isPending || !selected || series.isError) return
    try {
      await mutation.mutateAsync({
        seriesCode: selected.seriesCode,
        date: data.date,
        quantity: Number(data.quantity),
      })
      reset(defaults())
      mutation.reset()
      onOpenChange(false)
    } catch {
      // Keep the form open so the user can correct or retry the operation.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PolishEagleIcon size={20} />
            Obligacje skarbowe
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 flex flex-col gap-4"
        >
          <fieldset disabled={mutation.isPending} className="contents">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="bond-date"
                className="text-13 font-medium text-foreground"
              >
                Data zakupu
              </label>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    id="bond-date"
                    max={format(new Date(), 'yyyy-MM-dd')}
                    disabled={mutation.isPending}
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

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="bond-family"
                className="text-13 font-medium text-foreground"
              >
                Rodzaj obligacji
              </label>
              <Controller
                name="family"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    disabled={mutation.isPending}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="bond-family"
                      ref={field.ref}
                      onBlur={field.onBlur}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOND_FAMILIES.map((family) => (
                        <SelectItem key={family} value={family}>
                          {family}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="bond-series"
                className="text-13 font-medium text-foreground"
              >
                Emisja
              </label>
              <Input
                id="bond-series"
                value={series.isError ? '' : (selected?.seriesCode ?? '')}
                readOnly
                placeholder={
                  series.isPending
                    ? 'Pobieranie emisji…'
                    : 'Brak dopasowanej emisji'
                }
                aria-describedby="bond-series-description"
              />
              <p id="bond-series-description" className="text-12 text-ink-3">
                Emisja dobierana automatycznie według daty zakupu i rodzaju
                obligacji.
              </p>
              {series.isError ? (
                <div role="alert" className="text-12 text-destructive">
                  Nie udało się pobrać emisji.
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    disabled={mutation.isPending}
                    onClick={() => series.refetch()}
                  >
                    Spróbuj ponownie
                  </Button>
                </div>
              ) : series.isSuccess && series.data.length === 0 ? (
                <p className="text-12 text-ink-3">
                  Brak emisji tego rodzaju w katalogu dla wybranej daty.
                </p>
              ) : series.isSuccess && series.data.length > 1 ? (
                <p role="alert" className="text-12 text-destructive">
                  Nie można jednoznacznie dopasować emisji dla wybranej daty i
                  rodzaju obligacji.
                </p>
              ) : null}
            </div>

            <FloatInput
              id="bond-quantity"
              label="Liczba sztuk"
              min="1"
              max="2147483647"
              step="1"
              placeholder="1"
              error={errors.quantity?.message}
              {...register('quantity')}
            />

            <div
              className="rounded-md bg-muted p-3 text-13 text-ink-3"
              aria-live="polite"
            >
              <p>
                Cena za sztukę:{' '}
                {selected ? `${fmtNumber(selected.pricePerUnit)} PLN` : '—'}
              </p>
              <p>
                Oprocentowanie początkowe:{' '}
                {selected?.initialRatePct != null
                  ? `${fmtNumber(selected.initialRatePct)}% w skali roku`
                  : '—% w skali roku'}
              </p>
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
                disabled={!selected || series.isError || mutation.isPending}
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
