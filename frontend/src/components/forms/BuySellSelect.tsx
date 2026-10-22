import {
  OPERATION_LABELS,
  TRADE_OPERATION_TYPES,
  type TradeOperationType,
} from '@/types/portfolio'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BuySellSelectProps {
  value: TradeOperationType | ''
  onValueChange: (value: TradeOperationType) => void
  label?: string
  error?: string
}

export const BuySellSelect = ({
  value,
  onValueChange,
  label,
  error,
}: BuySellSelectProps) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-13 font-medium text-foreground">{label}</label>
      )}
      <Select
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue === 'buy' || nextValue === 'sell')
            onValueChange(nextValue)
        }}
      >
        <SelectTrigger className={error ? 'border-destructive' : undefined}>
          <SelectValue placeholder="Wybierz typ" />
        </SelectTrigger>
        <SelectContent>
          {TRADE_OPERATION_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {OPERATION_LABELS[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-12 text-destructive">{error}</p>}
    </div>
  )
}
