import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { useFxRates, useHoldings } from '@/api/portfolio'
import { cn } from '@/lib/utils'
import { fmtMoney, fmtNumber } from '@/lib/formatters'

export const HoldingsTable = () => {
  const { data: holdings, isLoading } = useHoldings()
  const { data: fx } = useFxRates()

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading || !holdings ? (
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
              {holdings.map((h) => {
                const pricePln =
                  h.price !== null && h.currency === 'USD' && fx
                    ? h.price * fx.USD_PLN
                    : null
                return (
                  <TableRow key={h.ticker}>
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
                    </TableCell>
                    <TableCell className="text-right">
                      {h.price !== null ? (
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1">
                            <Input
                              defaultValue={h.price.toLocaleString('pl-PL')}
                              className="w-20 text-right font-mono tabular"
                            />
                            <span className="font-mono text-tiny text-ink-3">
                              {h.currency}
                            </span>
                          </div>
                          {pricePln !== null && (
                            <span className="mt-0.5 font-mono text-tiny text-ink-4">
                              ≈ {fmtNumber(pricePln)} PLN
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-4">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular">
                      {fmtNumber(h.cost)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular font-medium">
                      {fmtNumber(h.value)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={cn(
                            'font-mono tabular font-medium',
                            h.change >= 0 ? 'text-pos' : 'text-neg'
                          )}
                        >
                          {fmtMoney(h.change, '', { sign: true })}
                        </span>
                        <DeltaPill value={h.changePct} className="mt-0.5" />
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
