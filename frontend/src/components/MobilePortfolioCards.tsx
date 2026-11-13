import {
  ASSET_KINDS,
  TableColumn,
  type useTableControls,
} from '@/components/TableColumn'
import { Trash2 } from 'lucide-react'
import { TickerBadge } from '@/components/TickerBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fmtMoney, fmtNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  CURRENCIES,
  OPERATION_LABELS,
  type Holding,
  type Operation,
} from '@/types/portfolio'

const numberOrDash = (value: number | null) =>
  value === null ? '—' : fmtNumber(value)

export const MobileHoldingCards = ({
  holdings,
  filtered,
  controls,
}: {
  holdings: Holding[]
  filtered: boolean
  controls: ReturnType<typeof useTableControls>
}) => (
  <div className="mobile-scrollbar-hidden h-full w-full min-w-0 overflow-y-auto overscroll-contain md:hidden">
    <table className="w-full table-fixed text-left">
      <caption className="sr-only">Aktywa portfela</caption>
      <colgroup>
        <col className="w-11" />
        <col />
        <col className="w-[30%]" />
        <col className="w-[30%]" />
      </colgroup>
      <thead className="sticky top-0 z-10 border-b border-border bg-surface-subtle text-[10px] font-medium text-ink-3">
        <tr>
          <TableColumn
            compact
            colSpan={2}
            className="pl-3 pr-1"
            label="Aktywo"
            sort="name"
            controls={controls}
            filters={[
              { key: 'name', label: 'Nazwa lub symbol' },
              { key: 'kind', label: 'Typ aktywa', options: ASSET_KINDS },
            ]}
          />
          <TableColumn
            compact
            className="pr-3"
            label="Wartość (PLN)"
            sort="value"
            right
            controls={controls}
          />
          <TableColumn
            compact
            className="pr-3"
            label="Bilans (PLN)"
            sort="change"
            right
            controls={controls}
          />
        </tr>
      </thead>
      {!holdings.length && (
        <tbody>
          <tr>
            <td colSpan={4} className="p-4 text-sm text-ink-3">
              {filtered
                ? 'Brak aktywów spełniających filtry.'
                : 'Brak aktywów. Dodaj pierwszą operację.'}
            </td>
          </tr>
        </tbody>
      )}
      {holdings.map((holding) => (
        <tbody
          key={holding.id}
          data-holding-row
          className="mobile-table-record"
        >
          <tr>
            <td rowSpan={2} className="pl-3 pr-1 pt-3 align-top">
              <TickerBadge ticker={holding.ticker} color={holding.color} />
            </td>
            <th scope="row" className="min-w-0 pr-1 pt-3 text-sm font-medium">
              <span className="block truncate" title={holding.ticker}>
                {holding.ticker}
              </span>
            </th>
            <td className="pr-3 pt-3 text-right font-mono text-xs tabular [overflow-wrap:anywhere]">
              {numberOrDash(holding.value)}
            </td>
            <td
              className={cn(
                'pr-3 pt-3 text-right font-mono text-xs font-medium tabular [overflow-wrap:anywhere]',
                holding.change !== null &&
                  (holding.change >= 0 ? 'text-pos' : 'text-neg')
              )}
            >
              {holding.change === null
                ? '—'
                : fmtMoney(holding.change, '', { sign: true })}
            </td>
          </tr>
          <tr>
            <td
              colSpan={3}
              className="pb-3 pr-3 pt-1 text-[11px] leading-relaxed text-ink-3 [overflow-wrap:anywhere]"
            >
              {holding.name}
            </td>
          </tr>
        </tbody>
      ))}
    </table>
  </div>
)

export const MobileOperationCards = ({
  operations,
  filtered,
  controls,
  deleting,
  onDelete,
}: {
  operations: Operation[]
  filtered: boolean
  controls: ReturnType<typeof useTableControls>
  deleting: boolean
  onDelete: (id: string) => void
}) => (
  <div className="mobile-scrollbar-hidden min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain md:hidden">
    <table className="w-full table-fixed text-left">
      <caption className="sr-only">Historia operacji</caption>
      <colgroup>
        <col className="w-24" />
        <col />
        <col className="w-12" />
      </colgroup>
      <thead className="sticky top-0 z-10 border-b border-border bg-surface-subtle">
        <tr>
          <TableColumn
            compact
            className="pl-3 pr-1"
            label="Operacja"
            sort="type"
            controls={controls}
          />
          <TableColumn
            compact
            className="pr-1"
            label="Aktywo"
            sort="name"
            controls={controls}
            filters={[
              { key: 'name', label: 'Nazwa zawiera' },
              {
                key: 'operation_type',
                label: 'Operacja',
                options: Object.entries(OPERATION_LABELS).map(
                  ([value, label]) => ({ value, label })
                ),
              },
              {
                key: 'kind',
                label: 'Typ aktywa',
                options: [
                  ...ASSET_KINDS,
                  { value: 'ETF', label: 'ETF' },
                  { value: 'XTB', label: 'XTB' },
                ],
              },
              {
                key: 'currency',
                label: 'Waluta',
                options: CURRENCIES.map((value) => ({ value, label: value })),
              },
              { key: 'date_from', label: 'Od', type: 'date' },
              { key: 'date_to', label: 'Do', type: 'date' },
            ]}
          />
          <th scope="col">
            <span className="sr-only">Akcje</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {!operations.length && (
          <tr>
            <td colSpan={3} className="p-4 text-sm text-ink-3">
              {filtered
                ? 'Brak operacji spełniających filtry.'
                : 'Brak operacji. Dodaj pierwszą operację.'}
            </td>
          </tr>
        )}
        {operations.map((operation) => (
          <tr key={operation.id} className="mobile-table-record">
            <td className="py-2 pl-3 pr-2 align-middle">
              <Badge
                className="max-w-full whitespace-normal px-2 py-1 text-[10px] leading-tight [overflow-wrap:anywhere]"
                variant={
                  operation.type === 'import'
                    ? 'default'
                    : operation.type === 'buy' || operation.type === 'deposit'
                      ? 'buy'
                      : 'sell'
                }
              >
                {operation.sourceLabel ?? OPERATION_LABELS[operation.type]}
              </Badge>
            </td>
            <th
              scope="row"
              className="py-2 pr-1 text-xs font-medium [overflow-wrap:anywhere]"
            >
              {operation.name}
            </th>
            <td className="py-2 pr-1 text-right align-middle">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                disabled={deleting}
                aria-label={
                  operation.type === 'import'
                    ? 'Usuń cały import XTB'
                    : `Usuń operację: ${operation.name}`
                }
                onClick={() => onDelete(operation.id)}
              >
                <Trash2 size={15} />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)
