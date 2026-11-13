import { MobileOperationCards } from '@/components/MobilePortfolioCards'
import { CURRENCIES, OPERATION_LABELS } from '@/types/portfolio'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useState } from 'react'

import {
  ASSET_KINDS,
  TableColumn,
  useTableControls,
} from '@/components/TableColumn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDeleteOperation, useOperations } from '@/api/portfolio'
import { filterOperations } from '@/lib/portfolioTableRows'
import { fmtNumber } from '@/lib/formatters'
import { format, parseISO } from 'date-fns'

export const OperationsTable = () => {
  const deleteOperation = useDeleteOperation()
  const [page, setPage] = useState(1)
  const controls = useTableControls(() => setPage(1))
  const { data, isError, refetch } = useOperations()
  const ops = data && filterOperations(data, controls.params)
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil((ops?.length ?? 0) / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * pageSize
  const visibleOperations = ops?.slice(pageStart, pageStart + pageSize)
  const numberOrDash = (value: number | null) =>
    value === null ? '—' : fmtNumber(value)

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Historia operacji</CardTitle>
          <CardDescription>
            {ops ? `Liczba wpisów: ${ops.length}` : ' '}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {deleteOperation.isError && (
          <div role="alert" className="p-6 text-sm text-negative">
            {deleteOperation.error.message}
          </div>
        )}
        {isError ? (
          <div role="alert" className="p-6 text-sm">
            Nie udało się pobrać historii operacji.
            <Button
              variant="outline"
              size="sm"
              className="ml-3"
              onClick={() => refetch()}
            >
              Spróbuj ponownie
            </Button>
          </div>
        ) : !ops ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <MobileOperationCards
              controls={controls}
              operations={visibleOperations ?? []}
              filtered={Boolean(controls.query)}
              deleting={deleteOperation.isPending}
              onDelete={(id) => deleteOperation.mutate(id)}
            />
            <Table containerClassName="hidden md:block" className="[&_td]:py-2">
              <TableHeader>
                <TableRow>
                  <TableColumn
                    label="Operacja"
                    sort="type"
                    controls={controls}
                    filters={[
                      {
                        key: 'operation_type',
                        label: 'Operacja',
                        options: Object.entries(OPERATION_LABELS).map(
                          ([value, label]) => ({ value, label })
                        ),
                      },
                    ]}
                  />
                  <TableColumn
                    label="Typ aktywa"
                    sort="kind"
                    controls={controls}
                    filters={[
                      {
                        key: 'kind',
                        label: 'Typ aktywa',
                        options: [
                          ...ASSET_KINDS,
                          { value: 'ETF', label: 'ETF' },
                          { value: 'XTB', label: 'XTB' },
                        ],
                      },
                    ]}
                  />
                  <TableColumn
                    label="Nazwa"
                    sort="name"
                    controls={controls}
                    filters={[{ key: 'name', label: 'Nazwa zawiera' }]}
                  />
                  <TableHead className="text-right">Wolumen</TableHead>
                  <TableHead className="text-right">Cena</TableHead>
                  <TableColumn
                    label="Waluta"
                    sort="currency"
                    controls={controls}
                    filters={[
                      {
                        key: 'currency',
                        label: 'Waluta',
                        options: CURRENCIES.map((value) => ({
                          value,
                          label: value,
                        })),
                      },
                    ]}
                  />
                  <TableColumn
                    label="Wartość (PLN)"
                    sort="value_pln"
                    right
                    controls={controls}
                  />
                  <TableColumn
                    label="Data"
                    sort="date"
                    controls={controls}
                    filters={[
                      { key: 'date_from', label: 'Od', type: 'date' },
                      { key: 'date_to', label: 'Do', type: 'date' },
                    ]}
                  />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ops.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-10 text-center text-ink-3"
                    >
                      {controls.query
                        ? 'Brak operacji spełniających filtry.'
                        : 'Brak operacji. Dodaj pierwszą operację.'}
                    </TableCell>
                  </TableRow>
                )}
                {visibleOperations?.map((o) => (
                  <TableRow key={o.id} className="h-[48px]">
                    <TableCell>
                      <Badge
                        variant={
                          o.type === 'import'
                            ? 'default'
                            : o.type === 'buy' || o.type === 'deposit'
                              ? 'buy'
                              : 'sell'
                        }
                      >
                        {o.sourceLabel ?? OPERATION_LABELS[o.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{o.kind}</TableCell>
                    <TableCell className="font-medium">
                      {o.name}
                      {o.operationCount != null && (
                        <span className="block text-xs font-normal text-ink-3">
                          {o.operationCount} operacji źródłowych
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {o.qty !== null && o.quantityUnit
                        ? `${fmtNumber(o.qty)} ${o.quantityUnit}`
                        : numberOrDash(o.qty)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {o.price !== null && o.quantityUnit
                        ? `${fmtNumber(o.price)}/${o.quantityUnit}`
                        : numberOrDash(o.price)}
                    </TableCell>
                    <TableCell>{o.currency}</TableCell>
                    <TableCell className="text-right font-mono tabular font-medium">
                      {numberOrDash(o.valuePln)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-3">
                      {format(parseISO(o.date), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={
                          o.type === 'import' ? 'Usuń cały import XTB' : 'Usuń'
                        }
                        title={
                          o.type === 'import' ? 'Usuń cały import XTB' : 'Usuń'
                        }
                        disabled={deleteOperation.isPending}
                        onClick={() => deleteOperation.mutate(o.id)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {ops.length > pageSize &&
                  Array.from(
                    { length: pageSize - (visibleOperations?.length ?? 0) },
                    (_, index) => (
                      <TableRow
                        key={`empty-${index}`}
                        aria-hidden="true"
                        className="h-[48px] hover:bg-transparent"
                      >
                        <TableCell colSpan={9} className="p-0" />
                      </TableRow>
                    )
                  )}
              </TableBody>
            </Table>
          </>
        )}
        {!isError && ops && ops.length > pageSize && (
          <nav
            aria-label="Paginacja historii operacji"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3"
          >
            <span className="text-xs text-ink-3" aria-live="polite">
              <span className="font-medium tabular-nums text-ink-2">
                {pageStart + 1}–{pageStart + (visibleOperations?.length ?? 0)}
              </span>{' '}
              z {ops.length} wpisów
            </span>
            <div className="flex items-center gap-1 rounded-md border border-border bg-surface-subtle p-1">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-sm disabled:opacity-30"
                aria-label="Poprzednia strona"
                title="Poprzednia strona"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </Button>
              <span
                className="relative min-w-16 px-2 text-center text-xs tabular-nums text-ink-3"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="sr-only">Strona </span>
                <span className="font-semibold text-foreground">
                  {currentPage}
                </span>
                <span className="mx-1.5">/</span>
                {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-sm disabled:opacity-30"
                aria-label="Następna strona"
                title="Następna strona"
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </CardContent>
    </Card>
  )
}
