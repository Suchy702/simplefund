import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ASSET_KINDS,
  TableColumn,
  useTableControls,
} from '@/components/TableColumn'
import { DeltaPill } from '@/components/DeltaPill'
import { TickerBadge } from '@/components/TickerBadge'
import { useHoldings } from '@/api/portfolio'
import { filterHoldings } from '@/lib/portfolioTableRows'
import { cn } from '@/lib/utils'
import { fmtMoney, fmtNumber } from '@/lib/formatters'

export const HoldingsTable = () => {
  const controls = useTableControls()
  const { data, isFetching, isError, refetch } = useHoldings()
  const holdings = data && filterHoldings(data, controls.params)
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
          <Table containerClassName="max-h-[551px]">
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableColumn
                  label="Aktywo"
                  sort="name"
                  controls={controls}
                  filters={[
                    { key: 'name', label: 'Nazwa lub symbol' },
                    { key: 'kind', label: 'Typ aktywa', options: ASSET_KINDS },
                  ]}
                />
                <TableColumn label="Wolumen" right controls={controls} />
                <TableColumn label="Cena" right controls={controls} />
                <TableColumn
                  label="Wkład (PLN)"
                  sort="cost"
                  right
                  controls={controls}
                />
                <TableColumn
                  label="Wartość (PLN)"
                  sort="value"
                  right
                  controls={controls}
                />
                <TableColumn
                  label="Bilans"
                  sort="change"
                  right
                  controls={controls}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-ink-3"
                  >
                    {controls.query
                      ? 'Brak aktywów spełniających filtry.'
                      : 'Brak aktywów. Dodaj pierwszą operację.'}
                  </TableCell>
                </TableRow>
              )}
              {holdings.map((h) => {
                return (
                  <TableRow key={h.id} className="h-[73px]">
                    <TableCell title={h.name}>
                      <div className="inline-flex items-center gap-2.5">
                        <TickerBadge ticker={h.ticker} color={h.color} />
                        <div>
                          <div className="font-medium text-foreground">
                            {h.ticker}
                          </div>
                          <div className="max-w-[100px] truncate text-tiny text-ink-3">
                            {h.name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-mono tabular">
                          {fmtNumber(h.qty)}
                        </span>
                        {h.quantityUnit && (
                          <span className="font-mono text-tiny text-ink-3">
                            {h.quantityUnit}
                          </span>
                        )}
                        {(h.class === 'Gotówka' || h.class === 'Lokata') && (
                          <span className="font-mono text-tiny text-ink-3">
                            {h.currency}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      title={h.valuationNote ?? undefined}
                    >
                      {h.class === 'Obligacje skarbowe' ? (
                        <span className="text-ink-4">—</span>
                      ) : h.price !== null ? (
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1">
                            <span className="font-mono tabular">
                              {fmtNumber(h.price)}
                            </span>
                            <span className="font-mono text-tiny text-ink-3">
                              {h.priceCurrency ?? h.currency}
                              {h.quantityUnit ? `/${h.quantityUnit}` : ''}
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
                    <TableCell
                      className="text-right font-mono tabular font-medium"
                      title={h.valuationNote ?? undefined}
                    >
                      {numberOrDash(h.value)}
                      {h.value === null &&
                        h.class === 'Obligacje skarbowe' &&
                        h.valuationNote && (
                          <div className="max-w-48 text-tiny font-normal text-ink-3">
                            {h.valuationNote}
                          </div>
                        )}
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
                        {h.paidInterest != null && h.paidInterest > 0 && (
                          <span
                            className="text-tiny text-ink-3"
                            title="Kupony brutto wypłacone według harmonogramu, uwzględnione w bilansie."
                          >
                            Wypłacono: {fmtNumber(h.paidInterest)} PLN
                          </span>
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
