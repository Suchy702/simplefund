import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeltaPill } from '@/components/DeltaPill'
import { TickerBadge } from '@/components/TickerBadge'
import { useHoldings } from '@/api/portfolio'
import { cn } from '@/lib/utils'
import { fmtMoney, fmtNumber } from '@/lib/formatters'

export const HoldingsTable = () => {
  const { data: holdings, isFetching, isError, refetch } = useHoldings()
  const numberOrDash = (value: number | null) =>
    value === null ? '—' : fmtNumber(value)

  return (
    <Card>
      <CardContent className="p-0">
        {isError ? (
          <div role="alert" className="p-6 text-sm">
            Nie udało się pobrać aktywów.
            <Button
              variant="outline"
              size="sm"
              className="ml-3"
              onClick={() => refetch()}
            >
              Spróbuj ponownie
            </Button>
          </div>
        ) : isFetching || !holdings ? (
          <div className="p-6">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aktywo</TableHead>
                <TableHead className="text-right">Wolumen</TableHead>
                <TableHead className="text-right">Cena</TableHead>
                <TableHead className="text-right">Wkład (PLN)</TableHead>
                <TableHead className="text-right">Wartość (PLN)</TableHead>
                <TableHead className="text-right">Bilans</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-ink-3"
                  >
                    Brak aktywów. Dodaj pierwszą wpłatę gotówki.
                  </TableCell>
                </TableRow>
              )}
              {holdings.map((h) => {
                return (
                  <TableRow key={h.id}>
                    <TableCell>
                      <div className="inline-flex items-center gap-2.5">
                        <TickerBadge ticker={h.ticker} color={h.color} />
                        <div>
                          <div className="font-medium text-foreground">
                            {h.ticker}
                          </div>
                          <div className="text-tiny text-ink-3">{h.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {fmtNumber(h.qty)}
                      {h.class === 'Gotówka' || h.class === 'Lokata'
                        ? ` ${h.currency}`
                        : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      {h.price !== null ? (
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1">
                            <span className="font-mono tabular">
                              {fmtNumber(h.price)}
                            </span>
                            <span className="font-mono text-tiny text-ink-3">
                              {h.priceCurrency ?? h.currency}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {numberOrDash(h.cost)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular font-medium">
                      {numberOrDash(h.value)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={cn(
                            'font-mono tabular font-medium',
                            h.change !== null &&
                              (h.change >= 0 ? 'text-pos' : 'text-neg')
                          )}
                        >
                          {h.change === null
                            ? '—'
                            : fmtMoney(h.change, '', { sign: true })}
                        </span>
                        {h.changePct !== null && (
                          <DeltaPill value={h.changePct} className="mt-0.5" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
