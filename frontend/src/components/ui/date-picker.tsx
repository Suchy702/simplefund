import { forwardRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  max?: string
  disabled?: boolean
  invalid?: boolean
}

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(
  ({ id, value, onChange, onBlur, max, disabled, invalid }, ref) => {
    const [open, setOpen] = useState(false)
    const selected = value ? parseISO(value) : undefined
    const currentYear = new Date().getFullYear()
    const selectedYear = selected?.getFullYear() ?? currentYear

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            onBlur={onBlur}
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-muted-foreground',
              invalid && 'border-destructive'
            )}
          >
            {selected ? format(selected, 'dd.MM.yyyy') : 'Wybierz datę'}
            <CalendarDays size={16} className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={pl}
            selected={selected}
            defaultMonth={selected}
            startMonth={new Date(Math.min(currentYear - 100, selectedYear), 0)}
            endMonth={
              max
                ? parseISO(max)
                : new Date(Math.max(currentYear + 100, selectedYear), 11)
            }
            formatters={{
              formatMonthDropdown: (date) => format(date, 'LLLL', { locale: pl }),
            }}
            labels={{ labelYearDropdown: () => 'Wybierz rok' }}
            className="w-[248px]"
            classNames={{
              weeks:
                'block h-[200px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              week: 'mt-2 flex h-8 w-full',
            }}
            disabled={disabled ? true : max ? { after: parseISO(max) } : undefined}
            onSelect={(date) => {
              if (!date) return
              onChange(format(date, 'yyyy-MM-dd'))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    )
  }
)
DatePicker.displayName = 'DatePicker'
