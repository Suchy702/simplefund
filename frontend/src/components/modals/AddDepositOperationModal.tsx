import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { BuySellSelect, FloatInput } from '@/components/forms'
import { cn } from '@/lib/utils'

const schema = z.object({
  operationType: z.enum(['buy', 'sell'], {
    required_error: 'Wybierz typ operacji',
  }),
  value: z.coerce
    .number({ invalid_type_error: 'Podaj wartość' })
    .positive('Wartość musi być większa od zera'),
  interestRate: z.coerce
    .number({ invalid_type_error: 'Podaj stopę procentową' })
    .min(0, 'Stopa procentowa nie może być ujemna')
    .max(100, 'Stopa procentowa nie może przekraczać 100%'),
  startDate: z.date({ required_error: 'Wybierz datę rozpoczęcia' }),
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
          <DialogTitle>Dodaj operację — Lokata</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-2 flex flex-col gap-4"
        >
          <Controller
            name="operationType"
            control={control}
            render={({ field }) => (
              <BuySellSelect
                label="Typ operacji"
                value={field.value ?? ''}
                onValueChange={field.onChange}
                error={errors.operationType?.message}
              />
            )}
          />

          <FloatInput
            label="Wartość"
            error={errors.value?.message}
            {...register('value')}
          />

          <FloatInput
            label="Stopa procentowa"
            suffix="%"
            error={errors.interestRate?.message}
            {...register('interestRate')}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-13 font-medium text-foreground">
              Data rozpoczęcia
            </label>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !field.value && 'text-ink-3',
                        errors.startDate && 'border-destructive'
                      )}
                    >
                      <CalendarIcon size={15} className="mr-2" />
                      {field.value
                        ? format(field.value, 'dd.MM.yyyy', { locale: pl })
                        : 'Wybierz datę'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.startDate && (
              <p className="text-12 text-destructive">
                {errors.startDate.message}
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
