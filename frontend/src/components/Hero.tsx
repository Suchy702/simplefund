import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolioKpi } from '@/api/portfolio'
import { cn } from '@/lib/utils'
import { fmtMoney, fmtNumber, fmtPct } from '@/lib/formatters'

const heroLayout =
  'grid grid-cols-[minmax(0,max-content)_minmax(0,max-content)] items-start justify-between gap-x-4 gap-y-6 md:justify-evenly md:gap-x-6 xl:grid-cols-[1.6fr_1fr_1fr_0.9fr_0.9fr] xl:gap-10 [&>div]:min-w-0'
const statRowLayout = 'contents [&>div]:min-w-0'

const HeroLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 text-tiny font-semibold uppercase tracking-widest2 text-ink-3">
    {children}
  </div>
)

const HeroStat = ({
  label,
  value,
  sub,
  toneClass,
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  toneClass?: string
  className?: string
}) => (
  <div className={className}>
    <HeroLabel>{label}</HeroLabel>
    <div
      className={cn(
        'font-mono tabular text-2xl font-semibold tracking-tighter2 text-foreground leading-tight [overflow-wrap:anywhere] sm:text-3xl xl:text-2xl',
        toneClass
      )}
    >
      {value}
    </div>
    {sub && <div className="mt-2 text-xs text-ink-3">{sub}</div>}
  </div>
)

export const Hero = () => {
  const { data, isFetching } = usePortfolioKpi()

  if (isFetching) {
    return (
      <Card className="mb-4 px-4 py-6 md:px-6 md:py-5 xl:px-9 xl:py-7">
        <div className={heroLayout}>
          <div className="col-span-2 [container-type:inline-size] xl:col-span-1">
            <Skeleton className="mb-3 h-3 w-24 max-w-full" />
            <Skeleton className="h-10 w-40 max-w-full" />
            <Skeleton className="mt-3 h-3 w-32 max-w-full" />
          </div>
          {[0, 1].map((row) => (
            <div key={row} className={statRowLayout}>
              {[0, 1].map((column) => (
                <div
                  key={column}
                  className={
                    column === 1
                      ? row === 0
                        ? 'xl:order-1'
                        : 'xl:order-2'
                      : undefined
                  }
                >
                  <Skeleton className="mb-3 h-3 w-24 max-w-full" />
                  <Skeleton className="h-10 w-40 max-w-full" />
                  <Skeleton className="mt-3 h-3 w-32 max-w-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="mb-4 p-6 md:py-5 xl:px-9 xl:py-7 text-ink-3">
        Nie udało się pobrać statystyk portfela.
      </Card>
    )
  }

  const { totalContrib, totalValue, balance, roi, xirr } = data
  const positive = balance !== null && balance >= 0

  return (
    <Card className="mb-4 px-4 py-6 md:px-6 md:py-5 xl:px-9 xl:py-7">
      <div className={heroLayout}>
        <div className="col-span-2 [container-type:inline-size] xl:col-span-1">
          <HeroLabel>Wartość portfela</HeroLabel>
          <div className="font-mono tabular text-[clamp(1.5rem,10cqw,2.625rem)] font-semibold tracking-tightest text-foreground">
            {totalValue === null ? '—' : fmtNumber(totalValue)}
            <span className="ml-2 inline-block whitespace-nowrap text-13 font-normal tracking-normal text-ink-3">
              PLN
            </span>
          </div>
          {!!data.unvaluedCount && (
            <div className="mt-2 text-xs text-ink-3">
              Brak wyceny części aktywów.
            </div>
          )}
        </div>

        <div className={statRowLayout}>
          <HeroStat
            label="Bilans"
            value={
              <>
                {balance === null ? '—' : fmtMoney(balance, '', { sign: true })}
                <span className="ml-2 inline-block whitespace-nowrap text-13 font-normal tracking-normal text-ink-3">
                  PLN
                </span>
              </>
            }
            toneClass={
              balance === null ? undefined : positive ? 'text-pos' : 'text-neg'
            }
          />

          <HeroStat
            className="xl:order-1"
            label="ROI"
            value={roi === null ? '—' : fmtPct(roi, { sign: true })}
            sub="całkowity zwrot"
            toneClass={
              roi === null ? undefined : roi >= 0 ? 'text-pos' : 'text-neg'
            }
          />
        </div>
        <div className={statRowLayout}>
          <HeroStat
            label="Wkład własny"
            value={
              <>
                {totalContrib === null ? '—' : fmtNumber(totalContrib)}
                <span className="ml-2 inline-block whitespace-nowrap text-13 font-normal tracking-normal text-ink-3">
                  PLN
                </span>
              </>
            }
          />
          <HeroStat
            className="xl:order-2"
            label="XIRR"
            value={xirr === null ? '—' : fmtPct(xirr, { sign: true })}
            sub="roczny wzrost"
            toneClass={
              xirr === null ? undefined : xirr >= 0 ? 'text-pos' : 'text-neg'
            }
          />
        </div>
      </div>
    </Card>
  )
}
