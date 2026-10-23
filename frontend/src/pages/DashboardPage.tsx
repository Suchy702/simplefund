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
import { formatSeriesDate } from '@/lib/performance'
import type { RangeKey } from '@/types/portfolio'

const DashboardPage = ({
  isAdmin,
  onOpenAdmin,
}: {
  isAdmin: boolean
  onOpenAdmin: () => void
}) => {
  const [range, setRange] = useState<RangeKey>('1R')
  const { data: kpi } = usePortfolioKpi()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      <Topbar isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />

      <main className="flex-1 overflow-y-auto px-8 pb-12 pt-8">
        <div className="mx-auto w-full max-w-[1280px]">
          <PageHead
            asOfDate={kpi?.asOfDate ? formatSeriesDate(kpi.asOfDate) : ''}
            syncedMinutesAgo={kpi?.syncedMinutesAgo ?? null}
          />

          <Hero />

          <div className="mb-4 grid grid-cols-[1fr_320px] gap-4">
            <HoldingsTable />
            <AllocationCard />
          </div>

          <PerformanceCard range={range} onRangeChange={setRange} />

          <PerformanceStats range={range} />

          <OperationsTable />
        </div>
      </main>
    </div>
  )
}

export default DashboardPage
