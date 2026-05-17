import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePortfolioKpi } from '@/api/portfolio';
import { cn } from '@/lib/utils';
import { fmtMoney, fmtNumber, fmtPct } from '@/lib/formatters';

function HeroLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-tiny font-semibold uppercase tracking-widest2 text-ink-3">
      {children}
    </div>
  );
}

function HeroStat({
  label,
  value,
  sub,
  toneClass,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  toneClass?: string;
}) {
  return (
    <div>
      <HeroLabel>{label}</HeroLabel>
      <div
        className={cn(
          'font-mono tabular text-2xl font-semibold tracking-tighter2 text-foreground leading-none',
          toneClass,
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

export function Hero() {
  const { data, isLoading } = usePortfolioKpi();

  if (isLoading || !data) {
    return (
      <Card className="mb-4 px-9 py-7">
        <div className="grid grid-cols-[1.6fr_1fr_0.9fr_0.9fr] items-start gap-10">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="mt-3 h-3 w-32" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const { totalContrib, totalValue, balance, roi, cagr } = data;
  const positive = balance >= 0;

  return (
    <Card className="mb-4 px-9 py-7">
      <div className="grid grid-cols-[1.6fr_1fr_0.9fr_0.9fr] items-start gap-10">
        <div>
          <HeroLabel>Wartość portfela</HeroLabel>
          <div className="font-mono tabular text-42 font-semibold tracking-tightest text-foreground">
            {fmtNumber(totalValue)}
            <span className="ml-1.5 text-lg font-medium tracking-normal text-ink-3">PLN</span>
          </div>
          <div
            className={cn(
              'mt-3.5 flex items-center gap-2 font-mono tabular text-13',
              positive ? 'text-pos' : 'text-neg',
            )}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: 'currentColor' }}
            />
            <span>{fmtMoney(balance, 'PLN', { sign: true })} łącznie</span>
          </div>
        </div>

        <HeroStat
          label="Wkład własny"
          value={fmtNumber(totalContrib)}
          sub="PLN · kapitał wpłacony"
        />
        <HeroStat
          label="ROI"
          value={fmtPct(roi, { sign: true })}
          sub="całkowity zwrot"
          toneClass={roi >= 0 ? 'text-pos' : 'text-neg'}
        />
        <HeroStat
          label="CAGR"
          value={fmtPct(cagr, { sign: true })}
          sub="roczny zwrot składany"
          toneClass={cagr >= 0 ? 'text-pos' : 'text-neg'}
        />
      </div>
    </Card>
  );
}
