import { OPERATION_LABELS } from '@/types/portfolio'
import { Download, Trash2 } from 'lucide-react'

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
import { useOperations } from '@/api/portfolio'
import { fmtNumber } from '@/lib/formatters'
import { format, parseISO } from 'date-fns'

export const OperationsTable = () => {
  const { data: ops, isLoading, isError, refetch } = useOperations()
  const numberOrDash = (value: number | null) =>
    value === null ? '—' : fmtNumber(value)

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Historia operacji</CardTitle>
          <CardDescription>
            {ops ? `Ostatnie ${ops.length} transakcji` : ' '}
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
        ) : isLoading || !ops ? (
          <div className="p-6">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operacja</TableHead>
                <TableHead>Typ aktywa</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead className="text-right">Wolumen</TableHead>
                <TableHead className="text-right">Cena</TableHead>
                <TableHead className="text-right">Wartość</TableHead>
                <TableHead>Waluta</TableHead>
                <TableHead>Data</TableHead>
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
                    Brak operacji. Dodaj pierwszą wpłatę gotówki.
                  </TableCell>
                </TableRow>
              )}
              {ops.map((o) => (
                <TableRow key={o.id}>
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
                  <TableCell className="font-mono text-xs text-ink-3">
                    {format(parseISO(o.date), 'dd.MM.yyyy')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Usuń"
                      title="Usuń"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
