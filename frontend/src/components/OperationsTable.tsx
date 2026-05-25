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

export function OperationsTable() {
  const { data: ops, isLoading } = useOperations()

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
        {isLoading || !ops ? (
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
              {ops.map((o, i) => (
                <TableRow key={`${o.name}-${o.date}-${i}`}>
                  <TableCell>
                    <Badge variant={o.type === 'Zakup' ? 'buy' : 'sell'}>
                      {o.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{o.kind}</TableCell>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {fmtNumber(o.qty)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular">
                    {fmtNumber(o.price)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular font-medium">
                    {fmtNumber(o.value)}
                  </TableCell>
                  <TableCell>{o.currency}</TableCell>
                  <TableCell className="font-mono text-xs text-ink-3">
                    {o.date}
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
