import { CURRENCIES } from '@/types/portfolio'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Landmark } from 'lucide-react'
import { useAddDepositOperation } from '@/api/portfolio'

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
import { FloatInput } from '@/components/forms'

const schema = z
  .object({
    value: z
      .string()
      .trim()
      .regex(
        /^\d{1,16}(\.\d{1,2})?$/,
        'Podaj kwotę z maksymalnie dwoma miejscami po przecinku'
      )
      .refine((value) => Number(value) > 0, 'Wartość musi być większa od zera'),
    currency: z.enum(CURRENCIES, {
      required_error: 'Wybierz walutę',
    }),
    interestRate: z
      .string()
      .trim()
      .regex(
        /^\d{1,3}(\.\d{1,2})?$/,
        'Podaj oprocentowanie z maksymalnie dwoma miejscami po przecinku'
      )
      .refine(
        (value) => Number(value) <= 100,
        'Oprocentowanie musi mieścić się w zakresie 0–100%'
      ),
    startDate: z
      .string()
      .date('Podaj prawidłową datę rozpoczęcia')
      .refine(
        (value) => value <= format(new Date(), 'yyyy-MM-dd'),
        'Data rozpoczęcia nie może być w przyszłości'
      ),
    maturityDate: z.string().date('Podaj prawidłową datę zapadalności'),
  })
  .refine((data) => data.maturityDate > data.startDate, {
    message: 'Data zapadalności musi być późniejsza niż data rozpoczęcia',
    path: ['maturityDate'],
  })

type FormValues = z.infer<typeof schema>

interface AddDepositOperationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const AddDepositOperationModal = ({
  open,
  onOpenChange,
}: AddDepositOperationModalProps) => {
  const mutation = useAddDepositOperation()
  const defaults = (): FormValues => ({
    value: '',
    currency: 'PLN',
    interestRate: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    maturityDate: '',
  })
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

  const handleClose = () => {
    if (mutation.isPending) return
    reset(defaults())
    mutation.reset()
    onOpenChange(false)
  }

  const onSubmit = async (data: FormValues) => {
    if (mutation.isPending) return
    try {
      await mutation.mutateAsync(data)
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
            <Landmark size={20} className="shrink-0" aria-hidden="true" />
            Lokaty
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 flex flex-col gap-4"
        >
          <fieldset disabled={mutation.isPending} className="contents">
            <FloatInput
              id="deposit-value"
              label="Wartość"
              min="0.01"
              step="0.01"
              error={errors.value?.message}
              {...register('value')}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-13 font-medium text-foreground">
                Waluta
              </label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      className={
                        errors.currency ? 'border-destructive' : undefined
                      }
                    >
                      <SelectValue placeholder="Wybierz walutę" />
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
              {errors.currency && (
                <p className="text-12 text-destructive">
                  {errors.currency.message}
                </p>
              )}
            </div>

            <FloatInput
              id="deposit-interest-rate"
              label="Oprocentowanie roczne"
              suffix="%"
              min="0"
              max="100"
              step="0.01"
              error={errors.interestRate?.message}
              {...register('interestRate')}
            />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="deposit-start-date"
                className="text-13 font-medium text-foreground"
              >
                Data rozpoczęcia
              </label>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    id="deposit-start-date"
                    max={format(new Date(), 'yyyy-MM-dd')}
                    disabled={mutation.isPending}
                    invalid={Boolean(errors.startDate)}
                  />
                )}
              />
              {errors.startDate && (
                <p className="text-12 text-destructive">
                  {errors.startDate.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="deposit-maturity-date"
                className="text-13 font-medium text-foreground"
              >
                Data zapadalności
              </label>
              <Controller
                name="maturityDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    id="deposit-maturity-date"
                    disabled={mutation.isPending}
                    invalid={Boolean(errors.maturityDate)}
                  />
                )}
              />
              {errors.maturityDate && (
                <p className="text-12 text-destructive">
                  {errors.maturityDate.message}
                </p>
              )}
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
              <Button type="submit" variant="brand">
                {mutation.isPending ? 'Zapisywanie…' : 'Dodaj'}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
