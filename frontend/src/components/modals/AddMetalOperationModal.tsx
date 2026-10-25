import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Gem } from 'lucide-react'

import { useAddMetalOperation, useMetals } from '@/api/portfolio'
import { BuySellSelect, FloatInput } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
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
import { CURRENCIES } from '@/types/portfolio'

const schema = z.object({
  metal: z.string().min(1, 'Wybierz kruszec'),
  operationType: z.enum(['buy', 'sell']),
  grams: z.string().trim().min(1, 'Podaj masę czystego kruszcu'),
  pricePerGram: z.string().trim().min(1, 'Podaj faktyczną cenę za gram'),
  currency: z.enum(CURRENCIES),
  date: z
    .string()
    .date('Podaj prawidłową datę')
    .refine(
      (value) => value <= format(new Date(), 'yyyy-MM-dd'),
      'Data operacji nie może być w przyszłości'
    ),
})

type FormValues = z.infer<typeof schema>

const defaults = (): FormValues => ({
  metal: '',
  operationType: 'buy',
  grams: '',
  pricePerGram: '',
  currency: 'PLN',
  date: format(new Date(), 'yyyy-MM-dd'),
})

interface AddMetalOperationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const AddMetalOperationModal = ({
  open,
  onOpenChange,
}: AddMetalOperationModalProps) => {
  const metals = useMetals(open)
  const mutation = useAddMetalOperation()
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })

  const clear = () => {
    reset(defaults())
    mutation.reset()
  }

  const handleClose = () => {
    if (mutation.isPending) return
    clear()
    onOpenChange(false)
  }

  const onSubmit = async (data: FormValues) => {
    const selected = metals.data?.find((item) => item.metal === data.metal)
    if (mutation.isPending || !selected) return
    try {
      await mutation.mutateAsync({ ...data, metal: selected.metal })
      clear()
      onOpenChange(false)
    } catch {
      // Preserve entered values so a failed operation can be corrected or retried.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gem size={20} className="shrink-0" aria-hidden="true" />
            Kruszce
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 flex flex-col gap-4"
        >
          <fieldset disabled={mutation.isPending} className="contents">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="metal-selection" className="text-13 font-medium">
                Kruszec
              </label>
              <Controller
                name="metal"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="metal-selection"
                      disabled={
                        metals.isPending || metals.isError || mutation.isPending
                      }
                      className={
                        errors.metal ? 'border-destructive' : undefined
                      }
                    >
                      <SelectValue
                        placeholder={
                          metals.isPending ? 'Ładowanie…' : 'Wybierz kruszec'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {metals.data?.map((item) => (
                        <SelectItem key={item.metal} value={item.metal}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.metal && (
                <p className="text-12 text-destructive">
                  {errors.metal.message}
                </p>
              )}
              {metals.isError && (
                <div role="alert" className="text-13 text-destructive">
                  Nie udało się pobrać kruszców.
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => metals.refetch()}
                  >
                    Spróbuj ponownie
                  </Button>
                </div>
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
              id="metal-grams"
              label="Masa czystego kruszcu (g)"
              min="0.00000001"
              step="0.00000001"
              error={errors.grams?.message}
              {...register('grams')}
            />
            <p className="-mt-2 text-12 text-ink-3">
              Podaj zawartość czystego metalu. Jedna uncja trojańska to
              31,1034768 g.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <FloatInput
                id="metal-price"
                label="Cena transakcji za gram"
                min="0.0001"
                step="0.0001"
                error={errors.pricePerGram?.message}
                {...register('pricePerGram')}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="metal-currency" className="text-13 font-medium">
                  Waluta transakcji
                </label>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="metal-currency"
                        disabled={mutation.isPending}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="metal-date" className="text-13 font-medium">
                Data operacji
              </label>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    id="metal-date"
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
            <p className="text-12 text-ink-3">
              Wpisz faktyczną cenę transakcji, uwzględniając poniesione koszty.
              Wycena portfela będzie orientacyjna, według kontraktów terminowych
              Yahoo, bez premii monet i sztabek ani marży skupu.
            </p>
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
                disabled={!metals.data?.length}
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
