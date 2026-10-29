import { PerformanceChart } from '@/components/PerformanceChart'
import { NestedDonut } from '@/components/NestedDonut'
import { Card } from '@/components/ui/card'
import { fmtMoney, fmtNumber, fmtPct } from '@/lib/formatters'
import {
  landingAllocation as allocation,
  landingHistory as history,
  landingKpi as kpi,
} from '@/mocks/landing'

export const LandingPortfolioPreview = () => (
  <figure
    className="relative isolate mx-auto m-0 w-full max-w-[540px] min-w-0 text-left"
    aria-label="Podgląd portfela SimpleFund"
  >
    <div
      className="landing-backplate pointer-events-none absolute -inset-x-2 -top-2 bottom-0 -z-10 rotate-2 rounded-lg border border-border bg-brand-soft sm:-inset-x-3 sm:-top-3"
      aria-hidden="true"
    />
    <Card className="landing-card border-border-strong shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Twój portfel</h2>
      </div>

      <div className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest2 text-ink-3">
          Wartość portfela
        </p>
        <p className="mt-2 font-mono text-[clamp(1.8rem,4vw,2.5rem)] font-semibold leading-tight tracking-tightest">
          {fmtNumber(kpi.totalValue)}
          <span className="ml-2 text-xs font-normal tracking-normal text-ink-3">
            PLN
          </span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-b border-border pb-4 sm:grid-cols-4">
          <div className="landing-stat">
            <p className="text-[9px] font-medium uppercase tracking-wider text-ink-3">
              Wkład własny
            </p>
            <p className="mt-1.5 font-mono text-xs font-medium">
              {fmtNumber(kpi.totalContrib)}
              <span className="ml-1 text-[9px] font-normal text-ink-3">
                PLN
              </span>
            </p>
          </div>
          <div className="landing-stat">
            <p className="text-[9px] font-medium uppercase tracking-wider text-ink-3">
              Bilans
            </p>
            <p className="mt-1.5 font-mono text-xs font-medium text-pos">
              {fmtMoney(kpi.balance, '', { sign: true })}
              <span className="ml-1 text-[9px] font-normal text-ink-3">
                PLN
              </span>
            </p>
          </div>
          {[
            { label: 'ROI', value: kpi.roi },
            { label: 'XIRR', value: kpi.xirr },
          ].map((stat) => (
            <div key={stat.label} className="landing-stat">
              <p className="text-[9px] font-medium uppercase tracking-wider text-ink-3">
                {stat.label}
              </p>
              <p className="mt-1.5 font-mono text-xs font-medium text-pos">
                {fmtPct(stat.value, { sign: true })}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold">Wyniki historyczne</h3>
          <span className="rounded-sm bg-surface-subtle px-2 py-1 text-[10px] font-medium text-ink-2">
            1R
          </span>
        </div>
        <div className="-mx-2 mt-2">
          <PerformanceChart
            series={history}
            showContribution={false}
            height={145}
          />
        </div>

        <div className="mt-3 border-t border-border pt-4">
          <h3 className="text-xs font-semibold">Struktura portfela</h3>
          <div className="mt-4 flex items-center gap-4 sm:gap-6">
            <NestedDonut
              outer={allocation.outer}
              inner={allocation.inner}
              size={112}
              outerThickness={12}
              innerThickness={8}
              gap={4}
            />
            <div className="min-w-0 flex-1 space-y-2.5">
              {allocation.outer.map((segment) => (
                <div
                  key={segment.name}
                  className="landing-legend flex items-center gap-2.5 text-xs"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-[3px]"
                    style={{ background: segment.color }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 text-ink-2">{segment.name}</span>
                  <span className="font-mono tabular text-ink-2">
                    {segment.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  </figure>
)
