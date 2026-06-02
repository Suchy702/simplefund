import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BuySellSelectProps {
  value: string
  onValueChange: (value: string) => void
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
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={error ? 'border-destructive' : undefined}>
          <SelectValue placeholder="Wybierz typ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="buy">Zakup</SelectItem>
          <SelectItem value="sell">Sprzedaż</SelectItem>
        </SelectContent>
      </Select>
      {error && <p className="text-12 text-destructive">{error}</p>}
    </div>
  )
}
