import { useState } from 'react'

import { AllocationCard } from '@/components/AllocationCard'
import { Hero } from '@/components/Hero'
import { HoldingsTable } from '@/components/HoldingsTable'
import { OperationsTable } from '@/components/OperationsTable'
import { PageHead } from '@/components/PageHead'
import { PerformanceCard } from '@/components/PerformanceCard'
import { PerformanceStats } from '@/components/PerformanceStats'
import { Topbar } from '@/components/Topbar'
import { usePortfolioKpi } from '@/api/portfolio'
import type { RangeKey } from '@/types/portfolio'

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>('1R')
  const { data: kpi } = usePortfolioKpi()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <Topbar />

      <main className="flex-1 overflow-y-auto px-8 pb-12 pt-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <PageHead
            asOfDate={kpi?.asOfDate ?? ''}
            syncedMinutesAgo={kpi?.syncedMinutesAgo ?? 0}
          />

          <Hero />

          <PerformanceCard range={range} onRangeChange={setRange} />

          <PerformanceStats range={range} />

          <div className="mb-4 grid grid-cols-[1fr_320px] gap-4">
            <HoldingsTable />
            <AllocationCard />
          </div>

          <OperationsTable />
        </div>
      </main>
    </div>
  )
}
