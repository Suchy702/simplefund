import { OPERATION_LABELS } from '@/types/portfolio'
import { ChevronLeft, ChevronRight, Download, Trash2 } from 'lucide-react'
import { useState } from 'react'

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
import { fmtNumber } from '@/lib/formatters'
import { format, parseISO } from 'date-fns'

export const OperationsTable = () => {
  const { data: ops, isError, refetch } = useOperations()
  const deleteOperation = useDeleteOperation()
  const [page, setPage] = useState(1)
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
            {ops ? `Liczba transakcji: ${ops.length}` : ' '}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Filtruj
          </Button>
          <Button variant="outline" size="sm">
            <Download size={13} />
            Eksport
          </Button>
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
          <Table containerClassName="max-h-[467px]">
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>Operacja</TableHead>
                <TableHead>Typ aktywa</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead className="text-right">Wolumen</TableHead>
                <TableHead className="text-right">Cena</TableHead>
                <TableHead className="text-right">Wartość</TableHead>
                <TableHead>Waluta</TableHead>
                <TableHead className="text-right">Wartość (PLN)</TableHead>
                <TableHead>Data</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ops.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-10 text-center text-ink-3"
                  >
                    Brak operacji. Dodaj pierwszą operację.
                  </TableCell>
                </TableRow>
              )}
              {visibleOperations?.map((o) => (
                <TableRow key={o.id} className="h-[61px]">
                  <TableCell>
                    <Badge
                      variant={
                        o.type === 'buy' || o.type === 'deposit'
                          ? 'buy'
                          : 'sell'
                      }
                    >
                      {OPERATION_LABELS[o.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>{o.kind}</TableCell>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {numberOrDash(o.qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {numberOrDash(o.price)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular font-medium">
                    {numberOrDash(o.value)}
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
                      aria-label="Usuń"
                      title="Usuń"
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
                      className="h-[61px] hover:bg-transparent"
                    >
                      <TableCell colSpan={10} className="p-0" />
                    </TableRow>
                  )
                )}
            </TableBody>
          </Table>
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
              z {ops.length} transakcji
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
