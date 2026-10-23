import {
  CURRENCIES,
  CASH_OPERATION_TYPES,
  OPERATION_LABELS,
} from '@/types/portfolio'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { useAddCashOperation } from '@/api/portfolio'

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

const schema = z.object({
  operationType: z.enum(CASH_OPERATION_TYPES, {
    required_error: 'Wybierz typ operacji',
  }),
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
  date: z
    .string()
    .date('Podaj prawidłową datę')
    .refine(
      (value) => value <= format(new Date(), 'yyyy-MM-dd'),
      'Data nie może być w przyszłości'
    ),
})

type FormValues = z.infer<typeof schema>

interface AddCashOperationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const AddCashOperationModal = ({
  open,
  onOpenChange,
}: AddCashOperationModalProps) => {
  const mutation = useAddCashOperation()
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      operationType: 'deposit',
      currency: 'PLN',
      date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const handleClose = () => {
    if (mutation.isPending) return
    reset({
      operationType: 'deposit',
      currency: 'PLN',
      date: format(new Date(), 'yyyy-MM-dd'),
      value: '',
    })
    mutation.reset()
    onOpenChange(false)
  }

  const onSubmit = async (data: FormValues) => {
    if (mutation.isPending) return
    try {
      await mutation.mutateAsync(data)
      reset()
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
          <DialogTitle>Dodaj operację — Gotówka</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 flex flex-col gap-4"
        >
          <fieldset disabled={mutation.isPending} className="contents">
            <div className="flex flex-col gap-1.5">
              <label className="text-13 font-medium text-foreground">
                Typ operacji
              </label>
              <Controller
                name="operationType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      className={
                        errors.operationType ? 'border-destructive' : undefined
                      }
                    >
                      <SelectValue placeholder="Wybierz typ operacji" />
                    </SelectTrigger>
                    <SelectContent>
                      {CASH_OPERATION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {OPERATION_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.operationType && (
                <p className="text-12 text-destructive">
                  {errors.operationType.message}
                </p>
              )}
            </div>

            <FloatInput
              id="cash-value"
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

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cash-date"
                className="text-13 font-medium text-foreground"
              >
                Data operacji
              </label>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    id="cash-date"
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
