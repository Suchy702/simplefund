import {
  CURRENCIES,
  CASH_OPERATION_TYPES,
  OPERATION_LABELS,
} from '@/types/portfolio'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
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
  value: z.coerce
    .number({ invalid_type_error: 'Podaj wartość' })
    .positive('Wartość musi być większa od zera'),
  currency: z.enum(CURRENCIES, {
    required_error: 'Wybierz walutę',
  }),
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
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const onSubmit = (data: FormValues) => {
    console.log(data)
    handleClose()
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
            label="Wartość"
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

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Anuluj
            </Button>
            <Button type="submit" variant="brand">
              Dodaj
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
