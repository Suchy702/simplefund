import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Filter } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const ASSET_KINDS = [
  'Akcje',
  'Lokata',
  'Depozyt',
  'Gotówka',
  'Obligacje skarbowe',
  'Kruszce',
  'Kryptowaluty',
].map((value) => ({ value, label: value }))

export const useTableControls = (onChange?: () => void) => {
  const [params, setParams] = useState<Record<string, string>>({})
  const update = (values: Record<string, string>) => {
    setParams((previous) => {
      const next = { ...previous, ...values }
      return Object.fromEntries(
        Object.entries(next).filter(([, value]) => value)
      )
    })
    onChange?.()
  }
  return { params, update, query: new URLSearchParams(params).toString() }
}

export interface FilterField {
  key: string
  label: string
  type?: 'date'
  options?: readonly { value: string; label: string }[]
}

interface TableColumnProps {
  label: string
  compact?: boolean
  className?: string
  colSpan?: number
  sort?: string
  right?: boolean
  filters?: FilterField[]
  controls: ReturnType<typeof useTableControls>
}

export const TableColumn = ({
  label,
  compact = false,
  className,
  colSpan,
  sort,
  right,
  filters,
  controls,
}: TableColumnProps) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const { params, update } = controls
  const sorted = Boolean(sort && params.sort === sort)
  const filtered = filters?.some((field) => Boolean(params[field.key]))
  const SortIcon = sorted
    ? params.direction === 'desc'
      ? ArrowDown
      : ArrowUp
    : ArrowUpDown
  const inputClass =
    'h-9 w-full rounded-sm border border-border bg-card px-2 text-sm text-foreground'

  return (
    <TableHead
      scope="col"
      colSpan={colSpan}
      className={cn(
        compact &&
          'h-auto whitespace-normal px-0 py-2 text-[10px] normal-case tracking-normal',
        className
      )}
      aria-sort={
        sorted
          ? params.direction === 'desc'
            ? 'descending'
            : 'ascending'
          : undefined
      }
    >
      <div
        className={cn(
          'flex items-center gap-1',
          compact && 'gap-0.5',
          right && 'justify-end'
        )}
      >
        <span>{label}</span>
        {sort && (
          <button
            type="button"
            className={cn(
              'rounded-sm p-1 hover:text-foreground focus-visible:outline focus-visible:outline-2',
              compact &&
                'flex h-7 w-7 min-h-0 min-w-0 shrink-0 items-center justify-center p-0',
              sorted && 'text-brand'
            )}
            title={`Sortuj: ${label}`}
            aria-label={`Sortuj: ${label}`}
            onClick={() =>
              update(
                sorted && params.direction === 'desc'
                  ? { sort: '', direction: '' }
                  : { sort, direction: sorted ? 'desc' : 'asc' }
              )
            }
          >
            <SortIcon size={13} />
          </button>
        )}
        {filters && (
          <Popover
            open={open}
            onOpenChange={(value) => {
              setOpen(value)
              if (value) setDraft(params)
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                title={`Filtruj: ${label}`}
                aria-label={`Filtruj: ${label}`}
                className={cn(
                  'rounded-sm p-1 hover:text-foreground focus-visible:outline focus-visible:outline-2',
                  compact &&
                    'flex h-7 w-7 min-h-0 min-w-0 shrink-0 items-center justify-center p-0',
                  filtered && 'text-brand'
                )}
              >
                <Filter size={13} fill={filtered ? 'currentColor' : 'none'} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  update(
                    Object.fromEntries(
                      filters.map((field) => [
                        field.key,
                        draft[field.key] ?? '',
                      ])
                    )
                  )
                  setOpen(false)
                }}
              >
                {filters.map((field) => (
                  <label key={field.key} className="block space-y-1 text-xs">
                    <span>{field.label}</span>
                    {field.options ? (
                      <select
                        className={inputClass}
                        value={draft[field.key] ?? ''}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            [field.key]: event.target.value,
                          })
                        }
                      >
                        <option value="">Wszystkie</option>
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={inputClass}
                        type={field.type ?? 'text'}
                        maxLength={field.type ? undefined : 200}
                        value={draft[field.key] ?? ''}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            [field.key]: event.target.value,
                          })
                        }
                      />
                    )}
                  </label>
                ))}
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    Zastosuj
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      update(
                        Object.fromEntries(
                          filters.map((field) => [field.key, ''])
                        )
                      )
                      setOpen(false)
                    }}
                  >
                    Wyczyść
                  </Button>
                </div>
              </form>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TableHead>
  )
}
