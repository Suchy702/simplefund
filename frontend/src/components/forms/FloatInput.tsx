import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FloatInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  suffix?: string
  label?: string
  error?: string
}

export const FloatInput = forwardRef<HTMLInputElement, FloatInputProps>(
  ({ suffix, label, error, className, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-13 font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <Input
            ref={ref}
            id={id}
            type="number"
            step="any"
            placeholder="0.00"
            className={cn(
              suffix && 'pr-7',
              error && 'border-destructive',
              className
            )}
            {...props}
          />
          {suffix && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-13 text-ink-3">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-12 text-destructive">{error}</p>}
      </div>
    )
  }
)
FloatInput.displayName = 'FloatInput'
