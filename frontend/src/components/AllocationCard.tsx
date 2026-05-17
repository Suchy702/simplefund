import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { NestedDonut } from '@/components/NestedDonut';
import { useAllocation, useHoldings } from '@/api/portfolio';
import type { AssetClass } from '@/types/portfolio';

const CLASS_ORDER: Record<AssetClass, number> = {
  Akcje: 0,
  Lokata: 1,
  Depozyt: 2,
};

export function AllocationCard() {
  const { data: allocation, isLoading: allocLoading } = useAllocation();
  const { data: holdings, isLoading: holdingsLoading } = useHoldings();

  const innerSegments = (() => {
    if (!holdings) return [];
    const total = holdings.reduce((s, h) => s + h.value, 0);
    const sorted = [...holdings].sort(
      (a, b) =>
        (CLASS_ORDER[a.class] ?? 9) - (CLASS_ORDER[b.class] ?? 9) ||
        b.value - a.value,
    );
    return sorted.map((h) => ({ pct: (h.value / total) * 100, color: h.color }));
  })();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Alokacja</CardTitle>
          <CardDescription>klasa aktywów · pojedyncze pozycje</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {allocLoading || holdingsLoading || !allocation ? (
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
            <NestedDonut
              outer={allocation.map((a) => ({ pct: a.pct, color: a.color }))}
              inner={innerSegments}
              size={240}
              outerThickness={20}
              innerThickness={14}
              gap={6}
            />
            <div className="flex w-full flex-col gap-3.5 border-t border-border pt-4">
              <div>
                <div className="mb-2 text-tiny font-medium uppercase tracking-wider2 text-ink-3">
                  Klasa aktywów
                </div>
                <div className="flex flex-col gap-3">
                  {allocation.map((a) => (
                    <div key={a.name} className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ background: a.color }}
                      />
                      <span className="flex-1 text-13 text-foreground">{a.name}</span>
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
  );
}
