import { useLayoutEffect, useRef, useState } from 'react'

import { AllocationCard } from '@/components/AllocationCard'
import { Hero } from '@/components/Hero'
import { HoldingsTable } from '@/components/HoldingsTable'
import {
  MobileDashboardNav,
  type SectionId,
} from '@/components/MobileDashboardNav'
import { OperationsTable } from '@/components/OperationsTable'
import { PageHead } from '@/components/PageHead'
import { PerformanceCard } from '@/components/PerformanceCard'
import { PerformanceStats } from '@/components/PerformanceStats'
import { Topbar } from '@/components/Topbar'
import { usePortfolioKpi } from '@/api/portfolio'
import { cn } from '@/lib/utils'
import { formatSeriesDate } from '@/lib/performance'
import type { RangeKey } from '@/types/portfolio'

const DashboardPage = ({
  isAdmin,
  onOpenAdmin,
}: {
  isAdmin: boolean
  onOpenAdmin: () => void
}) => {
  const scrollRef = useRef<HTMLElement>(null)
  const [activeSection, setActiveSection] =
    useState<SectionId>('portfolio-stats')
  const [range, setRange] = useState<RangeKey>('1R')
  const { data: kpi } = usePortfolioKpi()

  useLayoutEffect(() => {
    if (window.matchMedia('(max-width: 767.98px)').matches) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [activeSection])

  const sectionClass = (id: SectionId) =>
    cn('min-w-0 md:block', activeSection !== id && 'hidden')

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <Topbar isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />

      <main
        ref={scrollRef}
        className="mobile-scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 pb-12 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8"
      >
        <div className="mx-auto w-full max-w-[1280px]">
          <PageHead
            asOfDate={kpi?.asOfDate ? formatSeriesDate(kpi.asOfDate) : ''}
            syncedMinutesAgo={kpi?.syncedMinutesAgo ?? null}
            mobileActionsVisible={activeSection === 'portfolio-holdings'}
          />

          <section
            id="portfolio-stats"
            aria-label="Statystyki portfela"
            className={sectionClass('portfolio-stats')}
          >
            <Hero />
            <div className="mb-4">
              <AllocationCard />
            </div>
          </section>

          <section
            id="portfolio-holdings"
            aria-label="Aktywa portfela"
            className={cn(sectionClass('portfolio-holdings'), 'mb-4')}
          >
            <HoldingsTable />
          </section>

          <section
            id="portfolio-performance"
            aria-label="Wyniki historyczne"
            className={sectionClass('portfolio-performance')}
          >
            <PerformanceCard range={range} onRangeChange={setRange} />
            <PerformanceStats range={range} />
          </section>

          <section
            id="portfolio-operations"
            aria-label="Historia operacji"
            className={sectionClass('portfolio-operations')}
          >
            <OperationsTable />
          </section>
        </div>
      </main>
      <MobileDashboardNav active={activeSection} onSelect={setActiveSection} />
    </div>
  )
}

export default DashboardPage
