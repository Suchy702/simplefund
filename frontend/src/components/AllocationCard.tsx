import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NestedDonut } from '@/components/NestedDonut'
import { useAllocation } from '@/api/portfolio'
import { Button } from '@/components/ui/button'

export const AllocationCard = () => {
  const { data: allocation, isLoading, isError, refetch } = useAllocation()

  return (
    <Card>
      <CardContent>
        {isError ? (
          <div role="alert" className="text-sm">
            Nie udało się pobrać struktury portfela.
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              Spróbuj ponownie
            </Button>
          </div>
        ) : isLoading || !allocation ? (
          <div className="flex flex-col items-center gap-5">
            <Skeleton className="h-60 w-60 rounded-full" />
            <div className="w-full space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            {allocation.unvaluedCount > 0 && (
              <p role="status" className="text-sm text-ink-3">
                Udziały dotyczą wycenionej części portfela. Pozycje bez wyceny:{' '}
                {allocation.unvaluedCount}.
              </p>
            )}
            {allocation.outer.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-3">
                Brak wycenionych aktywów do pokazania.
              </p>
            ) : (
              <NestedDonut
                outer={allocation.outer}
                inner={allocation.inner}
                size={240}
                outerThickness={20}
                innerThickness={14}
                gap={6}
              />
            )}
            <div className="flex w-full flex-col gap-3.5 border-t border-border pt-4">
              <div>
                <div className="mb-2 text-tiny font-medium uppercase tracking-wider2 text-ink-3">
                  Klasa aktywów
                </div>
                <div className="flex flex-col gap-3">
                  {allocation.outer.map((a) => (
                    <div key={a.name} className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ background: a.color }}
                      />
                      <span className="flex-1 text-13 text-foreground">
                        {a.name}
                      </span>
                      <span className="font-mono tabular text-13 font-medium text-ink-2">
                        {a.pct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
