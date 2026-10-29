import { useState } from 'react'
import { Check, FileSpreadsheet } from 'lucide-react'

import { NestedDonut } from '@/components/NestedDonut'
import { PerformanceChart } from '@/components/PerformanceChart'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { fmtMoney, fmtNumber, fmtPct } from '@/lib/formatters'
import {
  landingDetailedAllocation,
  landingHistory,
  landingKpi,
} from '@/mocks/landing'

export const LandingXtbPreview = () => (
  <Card className="landing-card shadow-sm">
    <CardHeader className="px-5 py-4">
      <CardTitle>Import z XTB</CardTitle>
      <span className="text-xs text-ink-3">XLSX</span>
    </CardHeader>
    <div className="p-5 sm:p-6">
      <div className="landing-import-item flex items-center gap-3 rounded-md border border-border bg-surface-subtle p-4">
        <FileSpreadsheet
          size={25}
          strokeWidth={1.5}
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Raport XTB.xlsx</p>
          <p className="mt-1 text-xs text-ink-3">
            Transakcje i przepływy pieniężne
          </p>
        </div>
        <Check size={17} className="shrink-0 text-pos" aria-hidden="true" />
      </div>
      <div className="landing-import-item mt-5 rounded-lg border border-border p-4">
        <p className="text-sm font-semibold">
          VWCE.DE · Vanguard FTSE All-World
        </p>
        <p className="mt-1 text-xs text-ink-3">XTB · ETF</p>
        <p className="mt-3 inline-block rounded-sm bg-brand-soft px-2 py-1 text-[11px] text-primary">
          Dopasowano automatycznie — sprawdź
        </p>
        <div className="mt-3 rounded-md bg-surface-subtle p-3">
          <p className="text-xs font-medium">
            Yahoo: VWCE.DE · Vanguard FTSE All-World
          </p>
          <p className="mt-1 text-[11px] text-ink-3">XETRA · EUR</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink-3">
        Sprawdź dopasowanie instrumentów przed zatwierdzeniem importu.
      </p>
    </div>
  </Card>
)

export const LandingStatisticsPreview = () => (
  <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
    <Card className="landing-card shadow-sm">
      <CardHeader className="px-6 py-5">
        <CardTitle>Statystyki portfela</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 p-6 sm:gap-x-8 sm:gap-y-10 sm:p-8">
        {[
          {
            label: 'Wkład własny',
            value: fmtNumber(landingKpi.totalContrib),
            detail: 'PLN',
            tone: 'text-foreground',
          },
          {
            label: 'Bilans',
            value: fmtMoney(landingKpi.balance, '', { sign: true }),
            detail: 'PLN',
            tone: 'text-pos',
          },
          {
            label: 'ROI',
            value: fmtPct(landingKpi.roi, { sign: true }),
            detail: 'całkowity zwrot',
            tone: 'text-pos',
          },
          {
            label: 'XIRR',
            value: fmtPct(landingKpi.xirr, { sign: true }),
            detail: 'roczny wzrost',
            tone: 'text-pos',
          },
        ].map((stat) => (
          <div key={stat.label} className="landing-stat">
            <p className="text-[10px] font-medium uppercase tracking-wider text-ink-3">
              {stat.label}
            </p>
            <p
              className={`mt-3 font-mono text-lg font-medium tracking-tight sm:text-xl ${stat.tone}`}
            >
              {stat.value}
            </p>
            <p className="mt-2 text-xs text-ink-3">{stat.detail}</p>
          </div>
        ))}
      </div>
    </Card>
    <Card className="landing-card shadow-sm">
      <CardHeader className="px-6 py-5">
        <CardTitle>Struktura portfela</CardTitle>
      </CardHeader>
      <div className="flex flex-col items-center gap-7 p-6 sm:flex-row sm:gap-8 sm:p-8">
        <NestedDonut
          outer={landingDetailedAllocation.outer}
          inner={landingDetailedAllocation.inner}
          size={220}
          outerThickness={20}
          innerThickness={14}
          gap={6}
        />
        <div className="w-full min-w-0 flex-1 space-y-5">
          {landingDetailedAllocation.outer.map((segment) => (
            <div
              key={segment.name}
              className="landing-legend flex items-center gap-2.5 text-sm"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
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
    </Card>
  </div>
)

export const LandingHistoryPreview = () => {
  const [showContribution, setShowContribution] = useState(true)

  return (
    <Card className="landing-card shadow-sm">
      <CardHeader className="flex-wrap px-5 py-4">
        <CardTitle>Wyniki historyczne</CardTitle>
        <div className="flex items-center gap-4">
          <label className="relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs text-ink-2 hover:text-foreground">
            <input
              type="checkbox"
              checked={showContribution}
              onChange={(event) => setShowContribution(event.target.checked)}
              className="peer sr-only"
            />
            <span
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-ink-3 peer-checked:border-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card"
              aria-hidden="true"
            >
              {showContribution && (
                <span className="h-2 w-2 rounded-full bg-blue-500" />
              )}
            </span>
            Wkład własny
          </label>
          <span className="rounded-sm bg-surface-subtle px-2 py-1 text-xs font-medium">
            1R
          </span>
        </div>
      </CardHeader>
      <div className="px-3 pb-2 pt-4 sm:px-5">
        <PerformanceChart
          series={landingHistory}
          showContribution={showContribution}
          height={260}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-3 text-xs text-ink-3">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-pos" aria-hidden="true" />
          Wartość portfela
        </span>
        {showContribution && (
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-[#3b82f6]" aria-hidden="true" />
            Wkład własny
          </span>
        )}
      </div>
    </Card>
  )
}
